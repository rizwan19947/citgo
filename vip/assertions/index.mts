/* Node type-stripping: erasable syntax only — no enum, namespace, or parameter properties. See assertions/types.mts. */
import type { Check, CheckContext, CheckResult } from "./types.mts";
import { envChecks } from "./env.mts";
import { connectivityChecks } from "./connectivity.mts";
import { siteChecks } from "./sites.mts";
import { proxyChecks } from "./proxy.mts";
import { parseSites } from "../lib/siteConfig.mts";

export * from "./types.mts";

/** Registry. Order is presentation order: cheapest and most fundamental first. */
export const allChecks: Check[] = [
	...envChecks,
	...connectivityChecks,
	...siteChecks,
	...proxyChecks,
];

export interface BuildContextOptions {
	env?: Record<string, string | undefined>;
	repoRoot?: string;
	/** A running site's origin (--base-url). Undefined skips the proxy checks. */
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
