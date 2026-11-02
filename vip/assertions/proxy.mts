/* Node type-stripping: erasable syntax only — no enum, namespace, or parameter properties. See assertions/types.mts. */
import type { Check, CheckContext } from "./types.mts";
import { fail, pass, skip, timer } from "./types.mts";

/*
 * /dA asset-proxy round-trip.
 *
 * These need a running frontend, so they skip cleanly when baseUrl is absent rather than failing —
 * `npm run doctor` against .env alone should still be green. Pass --base-url, or set VIP_BASE_URL,
 * to exercise them.
 *
 * proxy.cacheable is the check that catches the live defect in app/dA/[...path]/route.ts: dotCMS
 * sends `cache-control: no-cache`, so the route's `|| "public, max-age=31536000, immutable"`
 * fallback never fires and every image is served uncached.
 */

const NO_STORE = /\b(no-cache|no-store|max-age=0)\b/i;

/** Find a real image identifier from live content so nothing is hardcoded to one asset. */
async function findAssetId(ctx: CheckContext): Promise<string | undefined> {
	const site = ctx.sites[0];
	if (!site) return undefined;
	try {
		const res = await ctx.fetch(`${ctx.dotcmsHost}/api/content/_search`, {
			method: "POST",
			headers: { Authorization: `Bearer ${ctx.authToken}`, "Content-Type": "application/json" },
			body: JSON.stringify({
				query: `+contentType:Article +live:true +conhost:${site.siteId}`,
				limit: 10,
			}),
		});
		const body = await res.json();
		const contentlets: Array<Record<string, unknown>> = body?.entity?.jsonObjectView?.contentlets ?? [];
		for (const c of contentlets) {
			const image = c.image;
			if (typeof image === "string" && image.length > 0) return image;
		}
	} catch {
		// fall through
	}
	return undefined;
}

interface ProxyProbe {
	status: number;
	contentType: string | null;
	cacheControl: string | null;
	vary: string | null;
	headers: [string, string][];
	assetId: string;
}

const probeCache = new WeakMap<CheckContext, Promise<ProxyProbe | Error | null>>();

function probe(ctx: CheckContext): Promise<ProxyProbe | Error | null> {
	let existing = probeCache.get(ctx);
	if (existing) return existing;

	existing = (async () => {
		if (!ctx.baseUrl) return null;
		const assetId = await findAssetId(ctx);
		if (!assetId) return new Error("could not find a live Article image to probe");
		try {
			const res = await ctx.fetch(`${ctx.baseUrl.replace(/\/$/, "")}/dA/${assetId}/200maxw/75q`);
			return {
				status: res.status,
				contentType: res.headers.get("content-type"),
				cacheControl: res.headers.get("cache-control"),
				vary: res.headers.get("vary"),
				headers: [...res.headers.entries()],
				assetId,
			};
		} catch (e) {
			return e instanceof Error ? e : new Error(String(e));
		}
	})();

	probeCache.set(ctx, existing);
	return existing;
}

const roundTrip: Check = {
	id: "proxy.round-trip",
	label: "/dA proxy returns an image",
	severity: "error",
	async run(ctx) {
		const t = timer();
		const p = await probe(ctx);
		if (p === null) return skip(roundTrip, "Skipped — no --base-url given", t());
		if (p instanceof Error) return fail(roundTrip, p.message, t());
		if (p.status !== 200) return fail(roundTrip, `Returned ${p.status} for /dA/${p.assetId}`, t(), { status: p.status });
		if (!p.contentType?.startsWith("image/")) {
			return fail(roundTrip, `Returned content-type "${p.contentType}", expected an image`, t());
		}
		return pass(roundTrip, `200 ${p.contentType}`, t(), { assetId: p.assetId });
	},
};

const cacheable: Check = {
	id: "proxy.cacheable",
	label: "/dA responses are cacheable",
	severity: "error",
	async run(ctx) {
		const t = timer();
		const p = await probe(ctx);
		if (p === null) return skip(cacheable, "Skipped — no --base-url given", t());
		if (p instanceof Error || p.status !== 200) return skip(cacheable, "Skipped — round-trip failed", t());

		const cc = p.cacheControl;
		if (!cc) return fail(cacheable, "No Cache-Control header — assets will not be cached", t());
		if (NO_STORE.test(cc)) {
			return fail(
				cacheable,
				`Cache-Control is "${cc}". /dA assets are content-addressed and immutable; this makes ` +
					`every image refetch on every navigation. The route inherits dotCMS's no-cache instead ` +
					`of overriding it.`,
				t(),
				{ cacheControl: cc },
			);
		}
		return pass(cacheable, `Cache-Control: ${cc}${p.vary ? ` (Vary: ${p.vary})` : ""}`, t(), {
			cacheControl: cc,
			vary: p.vary,
		});
	},
};

const noLeak: Check = {
	id: "proxy.no-leak",
	label: "/dA leaks neither the dotCMS host nor the auth token",
	severity: "error",
	async run(ctx) {
		const t = timer();
		const p = await probe(ctx);
		if (p === null) return skip(noLeak, "Skipped — no --base-url given", t());
		if (p instanceof Error) return skip(noLeak, "Skipped — round-trip failed", t());

		const host = ctx.dotcmsHost.replace(/^https?:\/\//, "");
		const leaked: string[] = [];
		for (const [name, value] of p.headers) {
			if (host && value.includes(host)) leaked.push(`${name} (dotCMS host)`);
			if (ctx.authToken && value.includes(ctx.authToken)) leaked.push(`${name} (auth token)`);
		}
		return leaked.length
			? fail(noLeak, `Leaked in response headers: ${leaked.join(", ")}`, t(), { leaked })
			: pass(noLeak, "No host or token in response headers", t());
	},
};

export const proxyChecks: Check[] = [roundTrip, cacheable, noLeak];
