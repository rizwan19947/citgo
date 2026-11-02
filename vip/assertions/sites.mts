/* Node type-stripping: erasable syntax only — no enum, namespace, or parameter properties. See assertions/types.mts. */
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Check, CheckContext, CheckResult, SiteEntry } from "./types.mts";
import { fail, pass, skip, timer } from "./types.mts";

/*
 * Multisite resolution matrix.
 *
 * Runs for EVERY configured SITE_N, not just the one FRONTEND_HOST_OVERRIDE pins. Multisite is
 * foundational in this project, and a site that only breaks once someone flips the override is a
 * site nobody discovers is broken.
 *
 * Concurrency is capped: these run against a rate-limited shared instance.
 */

const CONCURRENCY = 2;

async function mapCapped<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
	const out: R[] = new Array(items.length);
	let next = 0;
	const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
		while (next < items.length) {
			const i = next++;
			out[i] = await fn(items[i]);
		}
	});
	await Promise.all(workers);
	return out;
}

interface SiteProbe {
	site: SiteEntry;
	resolved: boolean;
	resolvedHostname?: string;
	issueCount?: number;
	error?: string;
}

async function probeSite(ctx: CheckContext, site: SiteEntry): Promise<SiteProbe> {
	const auth = { Authorization: `Bearer ${ctx.authToken}` };
	try {
		const siteRes = await ctx.fetch(`${ctx.dotcmsHost}/api/v1/site/${site.siteId}`, { headers: auth });
		if (!siteRes.ok) {
			return { site, resolved: false, error: `site lookup returned ${siteRes.status}` };
		}
		const body = await siteRes.json();
		const entity = body?.entity ?? {};
		// The SDK type says `hostname`; runtime has been seen using `hostName`. Accept either.
		const resolvedHostname: string | undefined = entity.hostname ?? entity.hostName;

		const searchRes = await ctx.fetch(`${ctx.dotcmsHost}/api/content/_search`, {
			method: "POST",
			headers: { ...auth, "Content-Type": "application/json" },
			body: JSON.stringify({
				query: `+contentType:Issue +live:true +conhost:${site.siteId}`,
				limit: 1,
			}),
		});
		const searchBody = await searchRes.json();
		const issueCount = searchBody?.entity?.resultsSize;

		return { site, resolved: true, resolvedHostname, issueCount };
	} catch (e) {
		return { site, resolved: false, error: e instanceof Error ? e.message : String(e) };
	}
}

const probeCache = new WeakMap<CheckContext, Promise<SiteProbe[]>>();

function probeAll(ctx: CheckContext): Promise<SiteProbe[]> {
	let existing = probeCache.get(ctx);
	if (!existing) {
		existing = mapCapped(ctx.sites, CONCURRENCY, (s) => probeSite(ctx, s));
		probeCache.set(ctx, existing);
	}
	return existing;
}

const resolves: Check = {
	id: "sites.resolve",
	label: "Every SITE_N identifier resolves to a real site",
	severity: "error",
	async run(ctx): Promise<CheckResult> {
		const t = timer();
		if (!ctx.sites.length) return skip(resolves, "Skipped — no sites configured", t());
		const probes = await probeAll(ctx);

		const broken = probes.filter((p) => !p.resolved);
		if (broken.length) {
			return fail(
				resolves,
				broken.map((p) => `${p.site.hostname}: ${p.error}`).join("; "),
				t(),
				{ broken: broken.map((p) => p.site.hostname) },
			);
		}

		// A resolvable id that belongs to a *different* site is the subtler failure.
		const mismatched = probes.filter(
			(p) => p.resolvedHostname && p.resolvedHostname !== p.site.hostname,
		);
		if (mismatched.length) {
			return fail(
				resolves,
				mismatched
					.map((p) => `SITE_${p.site.index} claims ${p.site.hostname} but the identifier resolves to ${p.resolvedHostname}`)
					.join("; "),
				t(),
				{ mismatched: mismatched.map((p) => ({ configured: p.site.hostname, actual: p.resolvedHostname })) },
			);
		}

		return pass(resolves, `${probes.length}/${probes.length} resolved`, t(), {
			sites: probes.map((p) => p.site.hostname),
		});
	},
};

const hasLiveIssue: Check = {
	id: "sites.live-issue",
	label: "Every site has at least one live Issue",
	severity: "error",
	async run(ctx) {
		const t = timer();
		if (!ctx.sites.length) return skip(hasLiveIssue, "Skipped — no sites configured", t());
		const probes = await probeAll(ctx);

		const empty = probes.filter((p) => p.resolved && !p.issueCount);
		if (empty.length) {
			// Without a live Issue the home page falls through to the generic Page renderer.
			return fail(
				hasLiveIssue,
				`No live Issue for: ${empty.map((p) => p.site.hostname).join(", ")} — the home page will not render`,
				t(),
				{ empty: empty.map((p) => p.site.hostname) },
			);
		}
		return pass(
			hasLiveIssue,
			probes
				.filter((p) => p.resolved)
				.map((p) => `${p.site.hostname}: ${p.issueCount}`)
				.join(", "),
			t(),
		);
	},
};

const assetsPresent: Check = {
	id: "sites.assets",
	label: "Every site's header logo exists on disk",
	severity: "error",
	async run(ctx) {
		const t = timer();
		if (!ctx.sites.length) return skip(assetsPresent, "Skipped — no sites configured", t());

		const missing = ctx.sites.filter(
			(s) => !existsSync(join(ctx.repoRoot, "public/assets", s.assetSlug, "header-logo.svg")),
		);
		if (missing.length) {
			return fail(
				assetsPresent,
				missing
					.map((s) => `${s.hostname}: public/assets/${s.assetSlug}/header-logo.svg`)
					.join("; "),
				t(),
				{ missing: missing.map((s) => s.assetSlug) },
			);
		}
		return pass(assetsPresent, `${ctx.sites.length} logo(s) present`, t());
	},
};

export const siteChecks: Check[] = [resolves, hasLiveIssue, assetsPresent];
