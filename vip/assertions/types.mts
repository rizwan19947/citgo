/*
 * Shared contract for the VIP check library.
 *
 * Consumed by the `doctor` CLI and, from Day 5, the scheduled watchdog — both of which are the
 * same command with different arguments. A check never reads process.env or the filesystem
 * directly; everything it needs arrives on CheckContext, which is what lets one implementation
 * serve both a pre-deploy gate and a remote content probe.
 *
 * ── Runtime constraint for everything under vip/ ──
 *
 * These files run on plain Node under *type stripping*, not a compiler: types are erased, never
 * transformed. Only erasable syntax works. `enum`, `namespace`, `import x = require()` and
 * parameter properties (`constructor(private x: T)`) each fail at run time with
 * ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX — while `tsc --noEmit` stays perfectly green, because
 * TypeScript has no objection to them. The type-checker will not catch this class of mistake;
 * only running `npm run doctor` will. Prefer a union type over an enum — `Severity` below is the
 * pattern to copy.
 *
 * The .mts extension forces ESM, since package.json declares no "type". ESM does no extension
 * guessing, so every relative import under vip/ ends in an explicit `.mts`.
 */

export type Severity = "error" | "warn" | "info";

export interface CheckResult {
	id: string;
	ok: boolean;
	severity: Severity;
	message: string;
	detail?: Record<string, unknown>;
	durationMs: number;
	/** Set when a check could not run (missing prerequisite) rather than failing on its merits. */
	skipped?: boolean;
}

/** One parsed SITE_N entry, plus whether site-config.ts's loop would actually see it. */
export interface SiteEntry {
	index: number;
	raw: string;
	hostname: string;
	siteId: string;
	assetSlug: string;
	/** False when an earlier gap in SITE_N numbering means the app silently drops this entry. */
	visibleToApp: boolean;
}

export interface CheckContext {
	sites: SiteEntry[];
	/** Every SITE_N key present in the environment, including ones after a numbering gap. */
	rawSiteKeys: string[];
	dotcmsHost: string;
	authToken: string;
	/** Deployed frontend origin. Undefined skips the proxy checks rather than failing them. */
	baseUrl?: string;
	env: Record<string, string | undefined>;
	repoRoot: string;
	fetch: typeof fetch;
}

export interface Check {
	id: string;
	label: string;
	severity: Severity;
	run(ctx: CheckContext): Promise<CheckResult>;
}

/* ---- result helpers: every check reports timing, so build results through these ---- */

export function timer() {
	const start = performance.now();
	return () => Math.round(performance.now() - start);
}

export function pass(
	check: Pick<Check, "id" | "severity">,
	message: string,
	durationMs: number,
	detail?: Record<string, unknown>,
): CheckResult {
	return { id: check.id, ok: true, severity: "info", message, durationMs, detail };
}

export function fail(
	check: Pick<Check, "id" | "severity">,
	message: string,
	durationMs: number,
	detail?: Record<string, unknown>,
): CheckResult {
	return { id: check.id, ok: false, severity: check.severity, message, durationMs, detail };
}

export function skip(
	check: Pick<Check, "id" | "severity">,
	message: string,
	durationMs = 0,
): CheckResult {
	return { id: check.id, ok: true, severity: "info", message, durationMs, skipped: true };
}
