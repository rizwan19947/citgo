/* Node type-stripping: erasable syntax only — no enum, namespace, or parameter properties. See assertions/types.mts. */
import { statSync } from "node:fs";
import { join } from "node:path";
import type { Check, CheckContext, CheckResult, SiteEntry } from "./types.mts";
import { fail, pass, skip, timer } from "./types.mts";
import { searchLive } from "../lib/dotcms.mts";

/*
 * Multisite resolution matrix.
 *
 * The doctor runs these for EVERY configured SITE_N, not just the one FRONTEND_HOST_OVERRIDE pins.
 * Multisite is foundational in this project, and a site that only breaks once someone flips the
 * override is a site nobody discovers is broken. The watchdog runs them for the one site it checks
 * (D12).
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
	resolvedIdentifier?: string;
	resolvedInode?: string;
	liveCount?: number;
	liveError?: string;
	error?: string;
}

async function probeSite(ctx: CheckContext, site: SiteEntry): Promise<SiteProbe> {
	let probe: SiteProbe;
	try {
		const siteRes = await ctx.fetch(`${ctx.dotcmsHost}/api/v1/site/${encodeURIComponent(site.siteId)}`, {
			headers: { Authorization: `Bearer ${ctx.authToken}` },
		});
		if (!siteRes.ok) {
			return { site, resolved: false, error: `site lookup returned ${siteRes.status}` };
		}
		const entity = (await siteRes.json())?.entity ?? {};
		probe = {
			site,
			resolved: true,
			// The SDK type says `hostname`; runtime has been seen using `hostName`. Accept either.
			resolvedHostname: entity.hostname ?? entity.hostName,
			resolvedIdentifier: entity.identifier,
			resolvedInode: entity.inode,
		};
	} catch (e) {
		return { site, resolved: false, error: e instanceof Error ? e.message : String(e) };
	}

	if (ctx.detailContentType) {
		try {
			probe.liveCount = (await searchLive(ctx, ctx.detailContentType, site.siteId, 1)).total;
		} catch (e) {
			probe.liveError = e instanceof Error ? e.message : String(e);
		}
	}
	return probe;
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
	commands: ["doctor", "watchdog"],
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

		// The configured value must be the site's identifier. Its shape proves nothing — older sites
		// have dashed identifiers, like inodes — so compare with what dotCMS returned.
		const wrongId = probes.filter((p) => p.resolvedIdentifier && p.resolvedIdentifier !== p.site.siteId);
		if (wrongId.length) {
			return fail(
				resolves,
				wrongId
					.map((p) =>
						p.resolvedInode === p.site.siteId
							? `SITE_${p.site.index} (${p.site.hostname}) uses the site's inode; use its identifier ${p.resolvedIdentifier}`
							: `SITE_${p.site.index} (${p.site.hostname}) resolves to identifier ${p.resolvedIdentifier}`,
					)
					.join("; "),
				t(),
				{ wrongId: wrongId.map((p) => ({ configured: p.site.siteId, identifier: p.resolvedIdentifier })) },
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
					.map(
						(p) =>
							`SITE_${p.site.index} claims ${JSON.stringify(p.site.hostname)} but the identifier ` +
							`resolves to ${JSON.stringify(p.resolvedHostname)}`,
					)
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

const liveContent: Check = {
	id: "sites.live-content",
	label: "Every site has published detail items",
	severity: "error",
	commands: ["doctor", "watchdog"],
	async run(ctx) {
		const t = timer();
		if (!ctx.sites.length) return skip(liveContent, "Skipped — no sites configured", t());
		if (!ctx.detailContentType) {
			return skip(
				liveContent,
				"Skipped — set DETAIL_CONTENT_TYPE to the content type with detail pages (for example Article)",
				t(),
			);
		}
		const probes = (await probeAll(ctx)).filter((p) => p.resolved);

		const failed = probes.filter((p) => p.liveError);
		if (failed.length) {
			return fail(liveContent, failed.map((p) => `${p.site.hostname}: ${p.liveError}`).join("; "), t());
		}
		const empty = probes.filter((p) => !p.liveCount);
		if (empty.length) {
			return fail(
				liveContent,
				`No published ${ctx.detailContentType} items on: ${empty.map((p) => p.site.hostname).join(", ")}`,
				t(),
				{ empty: empty.map((p) => p.site.hostname) },
			);
		}
		return pass(liveContent, probes.map((p) => `${p.site.hostname}: ${p.liveCount}`).join(", "), t());
	},
};

function isDirectory(path: string): boolean {
	try {
		return statSync(path).isDirectory();
	} catch {
		return false;
	}
}

const assetsPresent: Check = {
	id: "sites.assets",
	label: "Every site's asset folder exists",
	severity: "error",
	commands: ["doctor"],
	async run(ctx) {
		const t = timer();
		if (!ctx.sites.length) return skip(assetsPresent, "Skipped — no sites configured", t());

		const missing = ctx.sites.filter(
			(s) => !s.assetSlug || !isDirectory(join(ctx.repoRoot, "public/assets", s.assetSlug)),
		);
		if (missing.length) {
			return fail(
				assetsPresent,
				missing.map((s) => `${s.hostname}: public/assets/${s.assetSlug}/`).join("; "),
				t(),
				{ missing: missing.map((s) => s.assetSlug) },
			);
		}
		return pass(assetsPresent, `${ctx.sites.length} asset folder(s) present`, t());
	},
};

export const siteChecks: Check[] = [resolves, liveContent, assetsPresent];
