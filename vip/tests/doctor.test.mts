/* Node type-stripping: erasable syntax only — no enum, namespace, or parameter properties. See assertions/types.mts. */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { allChecks, buildContext, type CheckResult } from "../assertions/index.mts";
import { SITE_ID, SITE_INODE } from "./fake-dotcms.mts";
import { CLI, VIP, check, cli, dotcms, env, envFile, repo, setUpFakeDotcms } from "./helpers.mts";

/*
 * The doctor's tests. Everything runs against a fake dotCMS on localhost, never the client's.
 * Each bug from the 2026-11-02 audit (B1–B7 in docs/vip-offerings/03-plan.md) has a test.
 */

setUpFakeDotcms();

test("a correctly wired project passes every doctor check", async () => {
	const results = await check(env(), repo(), undefined, "doctor");
	for (const r of Object.values(results)) assert.ok(r.ok && !r.skipped, `${r.id}: ${r.message}`);
});

test("B1: SITE_N is read as the app reads it, so a stray space fails", async () => {
	const results = await check(env({ SITE_1: `one.example |${SITE_ID}|one`, FRONTEND_HOST_OVERRIDE: "one.example" }));
	assert.equal(results["env.site-format"].ok, false);
	assert.match(results["env.site-format"].message, /spaces/);
	assert.equal(results["env.frontend-host-override"].ok, false);
	assert.match(results["env.frontend-host-override"].message, /"one\.example "/);
});

describe("B2: version drift against the handover baseline", () => {
	test("passes when both match, reading the SDK version from package-lock.json", async () => {
		const r = (await check())["dotcms.version-baseline"];
		assert.ok(r.ok && !r.skipped, r.message);
		assert.equal(r.detail?.sdk, "1.4.0");
	});

	test("warns when dotCMS has been upgraded", async () => {
		dotcms.state.dotcmsVersion = "27.03.02-01";
		const r = (await check())["dotcms.version-baseline"];
		assert.equal(r.ok, false);
		assert.equal(r.severity, "warn");
		assert.match(r.message, /dotCMS 26\.08\.19-04 → 27\.03\.02-01/);
	});

	test("warns when the SDK has changed", async () => {
		const r = (await check(env(), repo({ sdk: "26.8.19-4" })))["dotcms.version-baseline"];
		assert.equal(r.ok, false);
		assert.match(r.message, /SDK 1\.4\.0 → 26\.8\.19-4/);
	});

	test("skips, saying why, when there's no baseline", async () => {
		const r = (await check(env(), repo({ baseline: null })))["dotcms.version-baseline"];
		assert.ok(r.skipped);
		assert.match(r.message, /baseline\.json/);
	});
});

test("B3: searches match the app's — one site, language 1, no SYSTEM_HOST", async () => {
	await check();
	const search = dotcms.requests.find((r) => r.path === "/api/content/_search");
	assert.ok(search, "no content search was made");
	const body = JSON.parse(search.body);
	assert.match(body.query, /\+contentType:Article/);
	assert.match(body.query, /\+languageId:1/);
	assert.match(body.query, /\+live:true/);
	assert.match(body.query, new RegExp(`\\+conhost:${SITE_ID}`));
	assert.doesNotMatch(body.query, /SYSTEM_HOST/);
	assert.equal(body.languageId, 1);
});

describe("B4: image fields shaped as objects", () => {
	for (const image of [{ identifier: "img123" }, { idPath: "/dA/img123/image/photo.jpg" }]) {
		test(`finds the image in ${JSON.stringify(image)}`, async () => {
			dotcms.state.content.Article[SITE_ID] = [{ title: "First", image }];
			const r = (await check(env(), repo(), dotcms.url, "watchdog"))["proxy.round-trip"];
			assert.ok(r.ok && !r.skipped, r.message);
			assert.equal(r.detail?.assetId, "img123");
		});
	}
});

describe("B5: identifiers judged by dotCMS, not by their shape", () => {
	test("a dashed identifier is fine", async () => {
		const dashed = "8a7d5e23-da1e-420a-b4f0-471e7da8ea2d";
		dotcms.state.sites = [{ identifier: dashed, inode: SITE_INODE, hostname: "one.example" }];
		dotcms.state.content.Article = { [dashed]: [{ image: "img123" }] };
		const results = await check(env({ SITE_1: `one.example|${dashed}|one` }));
		assert.ok(results["sites.resolve"].ok, results["sites.resolve"].message);
		assert.equal(results["env.site-identifier-shape"], undefined);
	});

	test("an inode in place of the identifier fails, naming the identifier", async () => {
		const r = (await check(env({ SITE_1: `one.example|${SITE_INODE}|one` })))["sites.resolve"];
		assert.equal(r.ok, false);
		assert.match(r.message, /inode/);
		assert.match(r.message, new RegExp(SITE_ID));
	});
});

test("B6: the command's output arrives whole, and its exit code reflects errors", async () => {
	const passing = await cli(repo({ files: { ".env": envFile(env()) } }));
	assert.equal(passing.code, 0);
	assert.ok(passing.report.results.length > 0);

	const failing = await cli(repo({ files: { ".env": envFile(env({ DOTCMS_AUTH_TOKEN: "revoked" })) } }));
	assert.equal(failing.code, 1);
	assert.equal(failing.report.results.find((r) => r.id === "dotcms.auth")?.ok, false);

	// process.exit() right after a large write cuts piped output short, so the command must not call it.
	assert.doesNotMatch(readFileSync(CLI, "utf8"), /^\s*process\.exit\(/m);
});

describe("B7: env files load in Next's order", () => {
	const files = () => ({
		".env": envFile(env({ DEFAULT_SITE_HOST: "wrong.example" })),
		".env.production": "DEFAULT_SITE_HOST=one.example",
	});
	const defaultSiteHost = (results: CheckResult[]) => results.find((r) => r.id === "env.default-site-host")?.ok;

	test(".env.production beats .env by default", async () => {
		assert.equal(defaultSiteHost((await cli(repo({ files: files() }))).report.results), true);
	});

	test("with NODE_ENV=development, .env.production isn't read", async () => {
		const { report } = await cli(repo({ files: files() }), { NODE_ENV: "development" });
		assert.equal(defaultSiteHost(report.results), false);
	});

	test("a real environment variable beats every file", async () => {
		const { report } = await cli(repo({ files: files() }), { DEFAULT_SITE_HOST: "wrong.example" });
		assert.equal(defaultSiteHost(report.results), false);
	});
});

test("removed checks and settings are gone", () => {
	const ids = allChecks.map((c) => c.id);
	for (const gone of [
		"env.site-identifier-shape",
		"dotcms.version-alignment",
		"dotcms.rate-limit",
		"sites.live-issue",
		"proxy.cacheable",
	]) {
		assert.ok(!ids.includes(gone), `${gone} is still registered`);
	}
	assert.equal(existsSync(join(VIP, "lib/cachedFetch.mts")), false);
	assert.equal(buildContext({ env: env({ VIP_BASE_URL: "https://example.com" }) }).baseUrl, undefined);
});

describe("works for any project, not just CITGO", () => {
	test("checks that need a content type skip, saying what to set", async () => {
		const results = await check(env({ DETAIL_CONTENT_TYPE: undefined }), repo(), dotcms.url);
		for (const id of ["sites.live-content", "proxy.round-trip", "content.latest", "content.images"]) {
			assert.ok(results[id].skipped, id);
			assert.match(results[id].message, /DETAIL_CONTENT_TYPE/);
		}
	});

	test("the live-content check uses the configured type", async () => {
		dotcms.state.content = { Story: { [SITE_ID]: [{ title: "A story" }] } };
		assert.ok((await check(env({ DETAIL_CONTENT_TYPE: "Story" })))["sites.live-content"].ok);
		dotcms.state.content = {};
		const r = (await check(env({ DETAIL_CONTENT_TYPE: "Story" })))["sites.live-content"];
		assert.equal(r.ok, false);
		assert.match(r.message, /No published Story items/);
	});

	test("the asset check needs only the site's folder", async () => {
		assert.ok((await check())["sites.assets"].ok);
		assert.equal((await check(env(), repo({ assetSlugs: [] })))["sites.assets"].ok, false);
	});
});

test("the override failure says what actually happens", async () => {
	const r = (await check(env({ FRONTEND_HOST_OVERRIDE: "missing.example" })))["env.frontend-host-override"];
	assert.match(r.message, /wrong or empty content/);
	assert.doesNotMatch(r.message, /fails silently/);
});
