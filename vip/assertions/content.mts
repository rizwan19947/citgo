/* Node type-stripping: erasable syntax only — no enum, namespace, or parameter properties. See assertions/types.mts. */
import type { Check, CheckContext } from "./types.mts";
import { fail, pass, skip, timer } from "./types.mts";
import { contentTypeDefinition, liveIdentifiers, resolveImageId, searchLive } from "../lib/dotcms.mts";
import { fetchSite, whyFailed } from "../lib/runningSite.mts";

/*
 * The watchdog's checks on a running site: its key pages, its newest detail items at their
 * addresses, and the images those items use (D16).
 *
 * A missing page has to answer 404 for these checks to see it. In this setup it does: pages call
 * notFound() before the response starts, so Next sends a real 404. A project that streams its pages
 * (loading.tsx) sends 200 for missing pages, and these checks would miss them.
 *
 * Pages load one at a time: each one makes several dotCMS calls through the site, and dotCMS is
 * rate-limited.
 */

const DEFAULT_LATEST = 5;
const DEFAULT_PAGE = "/";

/** WATCHDOG_LATEST: how many of the most recently changed items to check. */
function latestCount(ctx: CheckContext): number | Error {
	const raw = ctx.env.WATCHDOG_LATEST?.trim();
	if (!raw) return DEFAULT_LATEST;
	const count = Number(raw);
	return Number.isInteger(count) && count >= 1
		? count
		: new Error(`WATCHDOG_LATEST must be a whole number, 1 or more (it's "${raw}")`);
}

/** WATCHDOG_PAGES: the pages to load, comma-separated. */
function pagePaths(ctx: CheckContext): string[] | Error {
	const paths = (ctx.env.WATCHDOG_PAGES ?? "")
		.split(",")
		.map((p) => p.trim())
		.filter(Boolean);
	const bad = paths.filter((p) => !p.startsWith("/"));
	if (bad.length) return new Error(`WATCHDOG_PAGES entries must start with "/": ${bad.join(", ")}`);
	return paths.length ? paths : [DEFAULT_PAGE];
}

interface Load {
	status?: number;
	error?: string;
	ms: number;
}

/** Loads one page of the running site. Only the status matters, so the body is never read. */
async function load(ctx: CheckContext, baseUrl: string, path: string): Promise<Load> {
	const t = timer();
	try {
		const res = await fetchSite(ctx, `${baseUrl.replace(/\/+$/, "")}${path}`);
		await res.body?.cancel();
		return { status: res.status, ms: t() };
	} catch (e) {
		return { error: whyFailed(e), ms: t() };
	}
}

/** What went wrong with a load, for messages. */
const problem = (l: Load) => l.error ?? `returned ${l.status}`;

/** An item's name for results: its title, or else its identifier. Messages quote it. */
const nameOf = (item: Record<string, unknown>) => String(item.title ?? item.identifier ?? "untitled");

const pages: Check = {
	id: "content.pages",
	label: "Key pages load",
	severity: "error",
	commands: ["watchdog"],
	async run(ctx) {
		const t = timer();
		if (!ctx.baseUrl) return skip(pages, "Skipped — no --base-url given", t());
		const paths = pagePaths(ctx);
		if (paths instanceof Error) return fail(pages, paths.message, t());

		const loads: Array<Load & { path: string }> = [];
		for (const path of paths) loads.push({ path, ...(await load(ctx, ctx.baseUrl, path)) });
		const broken = loads.filter((l) => l.status !== 200);
		return broken.length
			? fail(pages, broken.map((l) => `${l.path}: ${problem(l)}`).join("; "), t(), { pages: loads })
			: pass(pages, `${paths.join(", ")} returned 200`, t(), { pages: loads });
	},
};

interface Newest {
	items: Array<Record<string, unknown>>;
	/** All published items of the type on the site. */
	total: number;
	urlMapPattern?: string;
	imageFields: string[];
}

type NewestOutcome = Newest | Error | { skipped: string };

const newestCache = new WeakMap<CheckContext, Promise<NewestOutcome>>();

/** The newest items of the detail type on the watchdog's site, read once per run. */
function newest(ctx: CheckContext): Promise<NewestOutcome> {
	let existing = newestCache.get(ctx);
	if (existing) return existing;

	existing = (async (): Promise<NewestOutcome> => {
		const type = ctx.detailContentType;
		if (!type) {
			return {
				skipped: "Skipped — set DETAIL_CONTENT_TYPE to the content type with detail pages (for example Article)",
			};
		}
		if (ctx.sites.length !== 1) return { skipped: "Skipped — the watchdog checks one site at a time" };
		const count = latestCount(ctx);
		if (count instanceof Error) return count;
		const definition = await contentTypeDefinition(ctx);
		if (definition instanceof Error) return definition;
		try {
			// Most recently changed first: new and edited content is where new errors appear (D16).
			const { total, contentlets } = await searchLive(ctx, type, ctx.sites[0].siteId, count, "modDate desc");
			return { items: contentlets, total, ...definition };
		} catch (e) {
			return e instanceof Error ? e : new Error(String(e));
		}
	})();

	newestCache.set(ctx, existing);
	return existing;
}

/**
 * An item's address, from its type's URL map pattern: /{issueSlug}/{slug} becomes
 * /2026-q3/fuel-prices. An Error names the fields the item leaves empty.
 */
function addressOf(pattern: string, item: Record<string, unknown>): string | Error {
	const empty: string[] = [];
	const path = pattern.replace(/\{([^}]+)\}/g, (_, field: string) => {
		const value = item[field];
		if (value === undefined || value === null || value === "") {
			empty.push(field);
			return "";
		}
		return encodeURIComponent(String(value));
	});
	return empty.length ? new Error(`its address needs ${empty.join(", ")}, which it leaves empty`) : path;
}

interface ItemLoad {
	item: string;
	identifier: unknown;
	modDate: unknown;
	path?: string;
	status?: number;
	error?: string;
}

const latest: Check = {
	id: "content.latest",
	label: "The newest detail items load at their addresses",
	severity: "error",
	commands: ["watchdog"],
	async run(ctx) {
		const t = timer();
		if (!ctx.baseUrl) return skip(latest, "Skipped — no --base-url given", t());
		const found = await newest(ctx);
		if ("skipped" in found) return skip(latest, found.skipped, t());
		if (found instanceof Error) return fail(latest, found.message, t());
		const type = ctx.detailContentType;
		const pattern = found.urlMapPattern;
		if (!pattern) {
			return fail(latest, `${type} has no URL map pattern in dotCMS, so its items have no addresses to check`, t());
		}
		// No items is sites.live-content's failure to report, not this check's.
		if (!found.items.length) return skip(latest, `Skipped — no published ${type} items`, t());

		const loads: ItemLoad[] = [];
		for (const item of found.items) {
			const entry = { item: nameOf(item), identifier: item.identifier, modDate: item.modDate };
			const path = addressOf(pattern, item);
			if (path instanceof Error) {
				loads.push({ ...entry, error: path.message });
				continue;
			}
			const l = await load(ctx, ctx.baseUrl, path);
			loads.push({ ...entry, path, status: l.status, error: l.error });
		}

		const broken = loads.filter((l) => l.status !== 200);
		const detail = { pattern, total: found.total, items: loads };
		return broken.length
			? fail(
					latest,
					broken
						.map((l) => `${JSON.stringify(l.item)}${l.path ? ` at ${l.path}` : ""}: ${l.error ?? `returned ${l.status}`}`)
						.join("; "),
					t(),
					detail,
				)
			: pass(latest, `Newest ${loads.length} of ${found.total} ${type} items returned 200, at ${pattern}`, t(), detail);
	},
};

const images: Check = {
	id: "content.images",
	label: "Images the newest detail items use are published",
	severity: "error",
	commands: ["watchdog"],
	async run(ctx) {
		const t = timer();
		const found = await newest(ctx);
		if ("skipped" in found) return skip(images, found.skipped, t());
		if (found instanceof Error) return fail(images, found.message, t());
		const type = ctx.detailContentType;
		if (!found.imageFields.length) return skip(images, `Skipped — ${type} has no image fields`, t());
		if (!found.items.length) return skip(images, `Skipped — no published ${type} items`, t());

		// Only the type's image fields: images placed inside the body text aren't covered.
		const uses = found.items.flatMap((item) =>
			found.imageFields.flatMap((field) => {
				const id = resolveImageId(item[field]);
				return id ? [{ id, item: nameOf(item), field }] : [];
			}),
		);
		if (!uses.length) return pass(images, `None of the newest ${found.items.length} ${type} items use an image`, t());

		const ids = [...new Set(uses.map((u) => u.id))];
		let published: Set<string>;
		try {
			published = await liveIdentifiers(ctx, ids);
		} catch (e) {
			return fail(images, `Image lookup failed: ${e instanceof Error ? e.message : String(e)}`, t());
		}
		const missing = uses.filter((u) => !published.has(u.id));
		return missing.length
			? fail(
					images,
					"Not published in dotCMS (deleted, archived or unpublished): " +
						missing.map((u) => `${u.id}, used by ${JSON.stringify(u.item)} (${u.field})`).join("; "),
					t(),
					{ missing },
				)
			: pass(
					images,
					`${ids.length} image(s) used by the newest ${found.items.length} ${type} item(s) are published`,
					t(),
				);
	},
};

export const contentChecks: Check[] = [pages, latest, images];
