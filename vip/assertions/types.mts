/*
 * Shared contract for the VIP check library.
 *
 * Two commands run these checks: the doctor (settings and dotCMS, before deploy) and the watchdog
 * (dotCMS and a running site). Each check lists the commands that run it, so a check both need is
 * written once (D7). A check gets its settings through CheckContext and never reads process.env
 * itself. Two checks also read files under CheckContext.repoRoot: the version check
 * (package-lock.json, vip/baseline.json) and the site assets check (public/assets/).
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

/** One SITE_N entry, split exactly as utils/site-config.ts splits it: on "|", untrimmed. */
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
	/** The configured sites. The watchdog narrows this to the one site it checks (D12). */
	sites: SiteEntry[];
	/** Every SITE_N key present in the environment, including ones after a numbering gap. */
	rawSiteKeys: string[];
	dotcmsHost: string;
	authToken: string;
	/** The content type that has detail pages (DETAIL_CONTENT_TYPE). Undefined skips the checks that need it. */
	detailContentType?: string;
	/** The running site's address (the watchdog's --base-url). Undefined skips the running-site checks. */
	baseUrl?: string;
	env: Record<string, string | undefined>;
	repoRoot: string;
	fetch: typeof fetch;
}

/** The doctor checks settings and dotCMS before deploy; the watchdog checks dotCMS and a running site. */
export type Command = "doctor" | "watchdog";

export interface Check {
	id: string;
	label: string;
	severity: Severity;
	/** The commands that run this check. */
	commands: Command[];
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
