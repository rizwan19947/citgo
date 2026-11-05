/* Node type-stripping: erasable syntax only — no enum, namespace, or parameter properties. See assertions/types.mts. */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { allChecks, buildContext, pickSite, type CheckResult } from "../assertions/index.mts";
import { SITE_ID } from "./fake-dotcms.mts";
import { check, cli, dotcms, env, envFile, repo, setUpFakeDotcms } from "./helpers.mts";

/*
 * The watchdog's tests (Stage 2 in docs/vip-offerings/03-plan.md). The fake dotCMS also plays the
 * running site: it serves the site's pages and /dA images.
 */

setUpFakeDotcms();

const SECOND_ID = "fedcba9876543210fedcba9876543210";

/** Runs `npm run watchdog` against the fake site, as one.example unless `args` say otherwise. */
const watchdog = (settings = env(), args = ["--site", "one.example"]) =>
	cli(repo({ files: { ".env": envFile(settings) } }), {}, ["--watchdog", "--base-url", dotcms.url, ...args]);

const find = (results: CheckResult[], id: string) => {
	const r = results.find((x) => x.id === id);
	assert.ok(r, `${id} didn't run`);
	return r;
};

/** Paths the checks loaded from the running site, in order (not dotCMS calls, not images). */
const pagesLoaded = () =>
	dotcms.requests.map((r) => r.path).filter((p) => !p.startsWith("/api/") && !p.startsWith("/dA/"));

/** Live detail items with addresses on the fake site, `modDate` 0 to count - 1. */
function articles(count: number) {
	const items = Array.from({ length: count }, (_, i) => ({
		identifier: `a${i}`,
		title: `Item ${i}`,
		slug: `item-${i}`,
		issueSlug: "issue-1",
		image: `img${i}`,
		modDate: i,
	}));
	dotcms.state.content.Article[SITE_ID] = items;
	dotcms.state.liveAssets = items.map((item) => item.image);
	for (const item of items) dotcms.state.pages[`/issue-1/${item.slug}`] = 200;
	return items;
}

test("a correctly wired site passes every watchdog check", async () => {
	const results = await check(env(), repo(), dotcms.url, "watchdog");
	for (const r of Object.values(results)) assert.ok(r.ok && !r.skipped, `${r.id}: ${r.message}`);
});

test("a run makes 7 dotCMS requests of its own, plus one per page or image it loads", async () => {
	const { code, report } = await watchdog();
	assert.equal(code, 0, JSON.stringify(report.results.filter((r) => !r.ok)));
	const own = dotcms.requests.filter((r) => r.path.startsWith("/api/")).map((r) => r.path);
	assert.equal(own.length, 7, own.join(", "));
	const loaded = dotcms.requests.filter((r) => !r.path.startsWith("/api/")).map((r) => r.path);
	assert.deepEqual(loaded, ["/dA/img123/200maxw/75q", "/", "/issue-1/first"]);
});

test("when nothing answers at the address, the checks say so in words", async () => {
	// A free local port with nothing listening on it.
	const server = createServer();
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	const { port } = server.address() as AddressInfo;
	await new Promise((resolve) => server.close(resolve));

	const results = await check(env(), repo(), `http://127.0.0.1:${port}`, "watchdog");
	for (const id of ["proxy.round-trip", "content.pages", "content.latest"]) {
		assert.equal(results[id].ok, false, id);
		assert.match(results[id].message, /nothing is answering at that address \(ECONNREFUSED\)/, id);
	}
});

describe("the doctor and the watchdog split the checks (D7)", () => {
	test("settings checks are the doctor's, running-site checks the watchdog's, the rest both", () => {
		for (const c of allChecks) {
			const expected = /^env\.|^sites\.assets$/.test(c.id)
				? ["doctor"]
				: /^proxy\.|^content\./.test(c.id)
					? ["watchdog"]
					: ["doctor", "watchdog"];
			assert.deepEqual(c.commands, expected, c.id);
		}
	});

	test("the doctor sends --base-url to the watchdog", async () => {
		const { code, report, stderr } = await cli(repo({ files: { ".env": envFile(env()) } }), {}, [
			"--base-url",
			dotcms.url,
		]);
		assert.equal(code, 1);
		assert.equal(report.results.length, 0);
		assert.match(stderr, /npm run watchdog -- --base-url/);
	});

	test("the watchdog needs --base-url", async () => {
		const { code, stderr } = await cli(repo({ files: { ".env": envFile(env()) } }), {}, ["--watchdog"]);
		assert.equal(code, 1);
		assert.match(stderr, /--base-url/);
	});
});

describe("one site per run (D12)", () => {
	const twoSites = (extra: Record<string, string | undefined> = {}) =>
		env({ SITE_2: `two.example|${SECOND_ID}|two`, ...extra });
	const pick = (settings: Record<string, string | undefined>, address: string, name?: string) =>
		pickSite(buildContext({ env: settings }), address, name);

	test("a deployed address picks the site with its hostname", () => {
		const site = pick(twoSites(), "https://two.example:8443/");
		assert.ok(!(site instanceof Error), String(site));
		assert.equal(site.hostname, "two.example");
	});

	test("an address that matches no site needs --site, and the message lists the sites", () => {
		const unnamed = pick(twoSites(), "https://preview.example.dev");
		assert.ok(unnamed instanceof Error);
		assert.match(unnamed.message, /--site/);
		assert.match(unnamed.message, /one\.example, two\.example/);
		const named = pick(twoSites(), "https://preview.example.dev", "two.example");
		assert.ok(!(named instanceof Error), String(named));
		assert.equal(named.hostname, "two.example");
	});

	test("a local address picks the site the local app serves, decided as the app decides", () => {
		const cases = [
			[twoSites({ FRONTEND_HOST_OVERRIDE: "two.example" }), "two.example"],
			[env({ SITE_2: `localhost|${SECOND_ID}|two` }), "localhost"],
			[twoSites({ DEFAULT_SITE_HOST: "two.example" }), "two.example"],
		] as const;
		for (const [settings, expected] of cases) {
			const site = pick(settings, "http://localhost:3000");
			assert.ok(!(site instanceof Error), String(site));
			assert.equal(site.hostname, expected);
		}
	});

	test("a --site the local app doesn't serve stops the run, saying how to fix it", async () => {
		const { code, report, stderr } = await watchdog(twoSites({ FRONTEND_HOST_OVERRIDE: "one.example" }), [
			"--site",
			"two.example",
		]);
		assert.equal(code, 1);
		assert.equal(report.results.length, 0);
		assert.match(stderr, /serves one\.example \(FRONTEND_HOST_OVERRIDE\), not two\.example/);
		assert.match(stderr, /set FRONTEND_HOST_OVERRIDE=two\.example and restart the app/);
	});

	test("--site names the site, and only that site is checked", async () => {
		const { code, report } = await watchdog(twoSites(), ["--site", "one.example"]);
		assert.equal(code, 0, JSON.stringify(report.results.filter((r) => !r.ok)));
		assert.equal(report.site, "one.example");
		const lookups = dotcms.requests.filter((r) => r.path.startsWith("/api/v1/site/")).map((r) => r.path);
		assert.deepEqual(lookups, [`/api/v1/site/${SITE_ID}`]);
	});
});

describe("key pages", () => {
	test("by default, only the home page", async () => {
		await check(env(), repo(), dotcms.url, "watchdog");
		assert.equal(pagesLoaded()[0], "/");
		assert.ok(!pagesLoaded().includes("/archives"));
	});

	test("each page in WATCHDOG_PAGES must return 200; failures are named", async () => {
		dotcms.state.pages["/archives"] = 200;
		dotcms.state.pages["/search"] = 500;
		const r = (await check(env({ WATCHDOG_PAGES: " /, /archives,/search " }), repo(), dotcms.url, "watchdog"))[
			"content.pages"
		];
		assert.equal(r.ok, false);
		assert.equal(r.message, "/search: returned 500");
		assert.deepEqual(pagesLoaded().slice(0, 3), ["/", "/archives", "/search"]);
	});

	test("entries must be paths", async () => {
		const r = (await check(env({ WATCHDOG_PAGES: "/,archives" }), repo(), dotcms.url, "watchdog"))["content.pages"];
		assert.equal(r.ok, false);
		assert.match(r.message, /must start with "\/": archives/);
	});
});

describe("newest items (D16)", () => {
	test("a missing article fails the run, by name", async () => {
		delete dotcms.state.pages["/issue-1/first"];
		const { code, report } = await watchdog();
		assert.equal(code, 1);
		const r = find(report.results, "content.latest");
		assert.equal(r.ok, false);
		assert.equal(r.message, `"First" at /issue-1/first: returned 404`);
	});

	test("only the WATCHDOG_LATEST most recently changed items are checked, newest first", async () => {
		articles(7);
		const r = (await check(env({ WATCHDOG_LATEST: "5" }), repo(), dotcms.url, "watchdog"))["content.latest"];
		assert.ok(r.ok, r.message);
		const search = dotcms.requests.find((q) => q.path === "/api/content/_search" && JSON.parse(q.body).sort);
		assert.ok(search, "no sorted search was made");
		assert.equal(JSON.parse(search.body).sort, "modDate desc");
		assert.equal(JSON.parse(search.body).limit, 5);
		assert.deepEqual(
			pagesLoaded().filter((p) => p !== "/"),
			["/issue-1/item-6", "/issue-1/item-5", "/issue-1/item-4", "/issue-1/item-3", "/issue-1/item-2"],
		);
	});

	test("when every item is missing, the failure asks whether the address serves the site", async () => {
		articles(2);
		dotcms.state.pages = { "/": 200 };
		const r = (await check(env(), repo(), dotcms.url, "watchdog"))["content.latest"];
		assert.equal(r.ok, false);
		assert.ok(r.message.startsWith(`All 2 returned 404. Check that ${dotcms.url} serves one.example. `), r.message);
	});

	test("addresses follow the type's URL map pattern from dotCMS", async () => {
		dotcms.state.contentTypes.Article.urlMapPattern = "/news/{slug}";
		dotcms.state.pages = { "/": 200, "/news/first": 200 };
		const r = (await check(env(), repo(), dotcms.url, "watchdog"))["content.latest"];
		assert.ok(r.ok, r.message);
		assert.match(r.message, /at \/news\/\{slug}$/);
	});

	test("a type with no URL map pattern fails, saying so", async () => {
		delete dotcms.state.contentTypes.Article.urlMapPattern;
		const r = (await check(env(), repo(), dotcms.url, "watchdog"))["content.latest"];
		assert.equal(r.ok, false);
		assert.match(r.message, /Article has no URL map pattern/);
	});

	test("an item missing part of its address fails, by name", async () => {
		dotcms.state.content.Article[SITE_ID] = [{ identifier: "a1", title: "First", slug: "first", modDate: 1 }];
		const r = (await check(env(), repo(), dotcms.url, "watchdog"))["content.latest"];
		assert.equal(r.ok, false);
		assert.equal(r.message, `"First": its address needs issueSlug, which it leaves empty`);
	});

	test("WATCHDOG_LATEST must be a whole number, 1 or more", async () => {
		for (const value of ["abc", "0", "2.5"]) {
			const r = (await check(env({ WATCHDOG_LATEST: value }), repo(), dotcms.url, "watchdog"))["content.latest"];
			assert.equal(r.ok, false, value);
			assert.match(r.message, /WATCHDOG_LATEST must be a whole number/);
		}
	});
});

describe("images", () => {
	test("a missing image fails the run, by name", async () => {
		dotcms.state.liveAssets = [];
		const { code, report } = await watchdog();
		assert.equal(code, 1);
		const r = find(report.results, "content.images");
		assert.equal(r.ok, false);
		assert.match(r.message, /img123, used by "First" \(image\)$/);
	});

	test("lookups cover every site and language, published images only", async () => {
		await check(env(), repo(), dotcms.url, "watchdog");
		const lookups = dotcms.requests.filter((r) => r.body.includes("+identifier:"));
		assert.equal(lookups.length, 1);
		const body = JSON.parse(lookups[0].body);
		assert.equal(body.query, `+identifier:("img123") +live:true`);
		assert.equal(body.languageId, undefined);
	});

	test("lookups go 100 images at a time", async () => {
		articles(150);
		const r = (await check(env({ WATCHDOG_LATEST: "150" }), repo(), dotcms.url, "watchdog"))["content.images"];
		assert.ok(r.ok, r.message);
		assert.equal(dotcms.requests.filter((q) => q.body.includes("+identifier:")).length, 2);
	});
});
