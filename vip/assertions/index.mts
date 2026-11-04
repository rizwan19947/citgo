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

/** Addresses that reach an app running on this machine, started with this repo's env files. */
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * The one site a watchdog run checks (D12): the site behind the base URL.
 * - A local address reaches an app started from this repo, so the env files say which site it
 *   serves, decided the way utils/site-config.ts decides: FRONTEND_HOST_OVERRIDE, else a SITE_N
 *   hostname matching the address, else DEFAULT_SITE_HOST. A --site that disagrees is an Error,
 *   since the app would answer for another site.
 * - Any other address: the SITE_N entry named with --site, or else the one whose hostname matches.
 * If no site is found, an Error that says why.
 */
export function pickSite(ctx: CheckContext, baseUrl: string, name?: string): SiteEntry | Error {
	let url: URL;
	try {
		url = new URL(baseUrl);
	} catch {
		return new Error(`--base-url "${baseUrl}" isn't a web address, e.g. https://www.example.com`);
	}
	if (url.protocol !== "http:" && url.protocol !== "https:") {
		return new Error(`--base-url "${baseUrl}" must start with http:// or https://`);
	}
	const find = (hostname: string) => ctx.sites.find((s) => s.hostname === hostname);

	if (LOCAL_HOSTS.has(url.hostname)) {
		const override = ctx.env.FRONTEND_HOST_OVERRIDE;
		const [served, why] = override
			? [override, "FRONTEND_HOST_OVERRIDE"]
			: find(url.hostname)
				? [url.hostname, "its hostname"]
				: [ctx.env.DEFAULT_SITE_HOST ?? "", "DEFAULT_SITE_HOST, as FRONTEND_HOST_OVERRIDE isn't set"];
		if (name && name !== served) {
			return new Error(
				`The app at ${baseUrl} serves ${served || "no site"} (${why}), not ${name}. ` +
					`To check ${name}, set FRONTEND_HOST_OVERRIDE=${name} and restart the app.`,
			);
		}
		return (
			find(served) ??
			new Error(`The app at ${baseUrl} serves ${served || "no site"} (${why}), which matches no SITE_N hostname. Run npm run doctor.`)
		);
	}

	const site = find(name ?? url.hostname);
	if (site) return site;
	const configured = ctx.sites.map((s) => s.hostname).join(", ") || "none";
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
