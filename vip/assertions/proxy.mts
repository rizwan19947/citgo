/* Node type-stripping: erasable syntax only — no enum, namespace, or parameter properties. See assertions/types.mts. */
import type { Check, CheckContext } from "./types.mts";
import { fail, pass, skip, timer } from "./types.mts";
import { contentTypeDefinition, resolveImageId, searchLive } from "../lib/dotcms.mts";
import { fetchSite, whyFailed } from "../lib/runningSite.mts";

/*
 * /dA image proxy round-trip, through the running site. The watchdog runs these; without a base URL
 * they skip.
 *
 * The test image comes from live content of DETAIL_CONTENT_TYPE, through that type's image fields
 * as dotCMS defines them, so nothing is tied to one project or one asset.
 */

/** A real image identifier from live detail content on the first site. */
async function findAssetId(ctx: CheckContext, contentType: string): Promise<string | Error> {
	const site = ctx.sites[0];
	if (!site) return new Error("no sites configured");
	const definition = await contentTypeDefinition(ctx);
	if (definition instanceof Error) return definition;
	if (!definition.imageFields.length) return new Error(`${contentType} has no image fields`);

	const { contentlets } = await searchLive(ctx, contentType, site.siteId, 10);
	for (const c of contentlets) {
		for (const field of definition.imageFields) {
			const id = resolveImageId(c[field]);
			if (id) return id;
		}
	}
	return new Error(`no live ${contentType} on ${site.hostname} has an image to test with`);
}

interface ProxyProbe {
	status: number;
	contentType: string | null;
	headers: [string, string][];
	assetId: string;
}

type ProbeOutcome = ProxyProbe | Error | { skipped: string };

const probeCache = new WeakMap<CheckContext, Promise<ProbeOutcome>>();

function probe(ctx: CheckContext): Promise<ProbeOutcome> {
	let existing = probeCache.get(ctx);
	if (existing) return existing;

	existing = (async (): Promise<ProbeOutcome> => {
		if (!ctx.baseUrl) return { skipped: "Skipped — no --base-url given" };
		if (!ctx.detailContentType) {
			return { skipped: "Skipped — set DETAIL_CONTENT_TYPE so the check can find a real image" };
		}
		try {
			const assetId = await findAssetId(ctx, ctx.detailContentType);
			if (assetId instanceof Error) return assetId;
			const res = await fetchSite(ctx, `${ctx.baseUrl.replace(/\/$/, "")}/dA/${assetId}/200maxw/75q`);
			// Only the status and headers matter, so the image itself isn't downloaded.
			await res.body?.cancel();
			return {
				status: res.status,
				contentType: res.headers.get("content-type"),
				headers: [...res.headers.entries()],
				assetId,
			};
		} catch (e) {
			return new Error(whyFailed(e));
		}
	})();

	probeCache.set(ctx, existing);
	return existing;
}

const roundTrip: Check = {
	id: "proxy.round-trip",
	label: "/dA proxy returns an image",
	severity: "error",
	commands: ["watchdog"],
	async run(ctx) {
		const t = timer();
		const p = await probe(ctx);
		if ("skipped" in p) return skip(roundTrip, p.skipped, t());
		if (p instanceof Error) return fail(roundTrip, p.message, t());
		if (p.status !== 200) return fail(roundTrip, `Returned ${p.status} for /dA/${p.assetId}`, t(), { status: p.status });
		if (!p.contentType?.startsWith("image/")) {
			return fail(roundTrip, `Returned content-type "${p.contentType}", expected an image`, t());
		}
		return pass(roundTrip, `200 ${p.contentType}`, t(), { assetId: p.assetId });
	},
};

const noLeak: Check = {
	id: "proxy.no-leak",
	label: "/dA leaks neither the dotCMS host nor the auth token",
	severity: "error",
	commands: ["watchdog"],
	async run(ctx) {
		const t = timer();
		const p = await probe(ctx);
		if ("skipped" in p) return skip(noLeak, p.skipped, t());
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

export const proxyChecks: Check[] = [roundTrip, noLeak];
