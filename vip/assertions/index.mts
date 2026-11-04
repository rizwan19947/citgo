/* Node type-stripping: erasable syntax only — no enum, namespace, or parameter properties. See assertions/types.mts. */
import type { Check, CheckContext, CheckResult, Command, SiteEntry } from "./types.mts";
import { envChecks } from "./env.mts";
import { connectivityChecks } from "./connectivity.mts";
import { siteChecks } from "./sites.mts";
import { proxyChecks } from "./proxy.mts";
import { contentChecks } from "./content.mts";
import { parseSites } from "../lib/siteConfig.mts";

export * from "./types.mts";

/** Registry. Order is presentation order: cheapest and most fundamental first. */
export const allChecks: Check[] = [
	...envChecks,
	...connectivityChecks,
	...siteChecks,
	...proxyChecks,
	...contentChecks,
];

/** The checks one command runs, in presentation order. */
export function checksFor(command: Command): Check[] {
	return allChecks.filter((c) => c.commands.includes(command));
}

export interface BuildContextOptions {
	env?: Record<string, string | undefined>;
	repoRoot?: string;
	/** The running site's address (the watchdog's --base-url). Undefined skips the running-site checks. */
	baseUrl?: string;
}

export function buildContext(options: BuildContextOptions = {}): CheckContext {
	const env = options.env ?? process.env;
	const { sites, rawSiteKeys } = parseSites(env);

	return {
		sites,
		rawSiteKeys,
		dotcmsHost: (env.DOTCMS_HOST ?? "").replace(/\/$/, ""),
		authToken: env.DOTCMS_AUTH_TOKEN ?? "",
		detailContentType: env.DETAIL_CONTENT_TYPE?.trim() || undefined,
		baseUrl: options.baseUrl,
		env,
		repoRoot: options.repoRoot ?? process.cwd(),
		fetch,
	};
}

/**
 * The one site a watchdog run checks (D12): the SITE_N entry named with --site, or else the one whose
 * hostname matches the base URL. If neither matches, an Error that lists the configured hostnames.
 */
export function pickSite(sites: SiteEntry[], baseUrl: string, name?: string): SiteEntry | Error {
	let url: URL;
	try {
		url = new URL(baseUrl);
	} catch {
		return new Error(`--base-url "${baseUrl}" isn't a web address, e.g. https://www.example.com`);
	}
	if (url.protocol !== "http:" && url.protocol !== "https:") {
		return new Error(`--base-url "${baseUrl}" must start with http:// or https://`);
	}

	const wanted = name ?? url.hostname;
	const site = sites.find((s) => s.hostname === wanted);
	if (site) return site;
	const configured = sites.map((s) => s.hostname).join(", ") || "none";
	return new Error(
		name
			? `--site ${name} matches no SITE_N hostname. Configured: ${configured}`
			: `${url.hostname} matches no SITE_N hostname, so name the site with --site. Configured: ${configured}`,
	);
}

export interface RunSummary {
	results: CheckResult[];
	errors: number;
	warnings: number;
	skipped: number;
	passed: number;
	durationMs: number;
	worst: "error" | "warn" | "ok";
}

export async function runChecks(ctx: CheckContext, checks: Check[] = allChecks): Promise<RunSummary> {
	const started = performance.now();
	const results: CheckResult[] = [];

	// Sequential: several checks share a memoised probe, and the instance is rate-limited.
	for (const check of checks) {
		try {
			results.push(await check.run(ctx));
		} catch (e) {
			results.push({
				id: check.id,
				ok: false,
				severity: check.severity,
				message: `Check threw: ${e instanceof Error ? e.message : String(e)}`,
				durationMs: 0,
			});
		}
	}

	const errors = results.filter((r) => !r.ok && r.severity === "error").length;
	const warnings = results.filter((r) => !r.ok && r.severity === "warn").length;
	const skipped = results.filter((r) => r.skipped).length;

	return {
		results,
		errors,
		warnings,
		skipped,
		passed: results.filter((r) => r.ok && !r.skipped).length,
		durationMs: Math.round(performance.now() - started),
		worst: errors ? "error" : warnings ? "warn" : "ok",
	};
}

/** Label lookup for renderers, which only receive results. */
export const checkLabels: Record<string, string> = Object.fromEntries(
	allChecks.map((c) => [c.id, c.label]),
);
