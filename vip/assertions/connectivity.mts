/* Node type-stripping: erasable syntax only — no enum, namespace, or parameter properties. See assertions/types.mts. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Check, CheckContext } from "./types.mts";
import { fail, pass, skip, timer } from "./types.mts";

/*
 * Reachability, auth, and SDK/core version alignment.
 *
 * Every request here is a GET against the client's live dev instance — read-only by ground rule,
 * and metered by a token bucket, so this module makes exactly one authenticated call and reuses
 * its headers for the version and rate-limit checks.
 */

/** Cheap authenticated endpoint that returns the dotCMS version headers. */
const PROBE_PATH = "/api/v1/appconfiguration";

interface Probe {
	status: number;
	headers: Headers;
	latencyMs: number;
}

const probeCache = new WeakMap<CheckContext, Promise<Probe | Error>>();

function probe(ctx: CheckContext): Promise<Probe | Error> {
	let existing = probeCache.get(ctx);
	if (existing) return existing;

	existing = (async () => {
		const started = performance.now();
		try {
			const res = await ctx.fetch(`${ctx.dotcmsHost}${PROBE_PATH}`, {
				headers: { Authorization: `Bearer ${ctx.authToken}` },
			});
			return { status: res.status, headers: res.headers, latencyMs: Math.round(performance.now() - started) };
		} catch (e) {
			return e instanceof Error ? e : new Error(String(e));
		}
	})();

	probeCache.set(ctx, existing);
	return existing;
}

const reachable: Check = {
	id: "dotcms.reachable",
	label: "dotCMS host is reachable",
	severity: "error",
	async run(ctx) {
		const t = timer();
		if (!ctx.dotcmsHost) return fail(reachable, "DOTCMS_HOST is not set", t());
		const p = await probe(ctx);
		if (p instanceof Error) {
			return fail(reachable, `Cannot reach ${ctx.dotcmsHost}: ${p.message}`, t(), { host: ctx.dotcmsHost });
		}
		const tls = ctx.dotcmsHost.startsWith("https://");
		return pass(reachable, `${p.status} in ${p.latencyMs}ms${tls ? " over TLS" : " — NOT over TLS"}`, t(), {
			status: p.status,
			latencyMs: p.latencyMs,
			tls,
		});
	},
};

const auth: Check = {
	id: "dotcms.auth",
	label: "Auth token is accepted",
	severity: "error",
	async run(ctx) {
		const t = timer();
		if (!ctx.authToken) return fail(auth, "DOTCMS_AUTH_TOKEN is not set", t());
		const p = await probe(ctx);
		if (p instanceof Error) return skip(auth, "Skipped — host unreachable", t());
		if (p.status === 401 || p.status === 403) {
			return fail(auth, `Token rejected (${p.status}) — expired or wrong instance`, t(), { status: p.status });
		}
		return pass(auth, `Accepted (${p.status})`, t());
	},
};

/** Installed @dotcms/client version, read from the dependency's own package.json. */
function installedSdkVersion(repoRoot: string): string | undefined {
	try {
		const pkg = JSON.parse(
			readFileSync(join(repoRoot, "node_modules/@dotcms/client/package.json"), "utf8"),
		);
		return pkg.version;
	} catch {
		return undefined;
	}
}

/** "1.4.0" is semver; "26.8.19-4" is the CalVer line that tracks core releases. */
function versionLine(v: string): "semver" | "calver" | "unknown" {
	if (/^\d{2}\.\d{1,2}\./.test(v)) return "calver";
	if (/^\d+\.\d+\.\d+/.test(v)) return "semver";
	return "unknown";
}

const versionAlignment: Check = {
	id: "dotcms.version-alignment",
	label: "SDK version aligns with core",
	severity: "warn",
	async run(ctx) {
		const t = timer();
		const p = await probe(ctx);
		if (p instanceof Error) return skip(versionAlignment, "Skipped — host unreachable", t());

		const core = p.headers.get("x-dotcms-version") ?? undefined;
		const minSdk = p.headers.get("x-dotcms-min-sdk") ?? undefined;
		const sdk = installedSdkVersion(ctx.repoRoot);

		if (!sdk) return skip(versionAlignment, "Skipped — @dotcms/client not installed", t());
		if (!core) return skip(versionAlignment, "Skipped — core sent no x-dotcms-version", t());

		const detail = { sdk, core, minSdk };

		// x-dotcms-min-sdk is currently a 0.0.0 placeholder instance-wide. When core starts
		// publishing a real floor this becomes the hard gate; until then, compare version lines.
		if (minSdk && minSdk !== "0.0.0" && versionLine(sdk) === versionLine(minSdk) && sdk < minSdk) {
			return fail(versionAlignment, `SDK ${sdk} is below the declared minimum ${minSdk}`, t(), detail);
		}

		if (versionLine(sdk) !== versionLine(core)) {
			return fail(
				versionAlignment,
				`SDK ${sdk} (${versionLine(sdk)}) and core ${core} (${versionLine(core)}) are on different ` +
					`version lines — the SDK is from the abandoned numbering scheme`,
				t(),
				detail,
			);
		}

		return pass(versionAlignment, `SDK ${sdk} against core ${core}`, t(), detail);
	},
};

const rateLimit: Check = {
	id: "dotcms.rate-limit",
	label: "Rate-limit budget",
	severity: "info",
	async run(ctx) {
		const t = timer();
		const p = await probe(ctx);
		if (p instanceof Error) return skip(rateLimit, "Skipped — host unreachable", t());

		const tokens = p.headers.get("x-dotratelimit-toks-max");
		const cost = p.headers.get("x-dotrequest-cost");
		if (!tokens) return skip(rateLimit, "Skipped — no rate-limit headers", t());

		const [remaining, max] = tokens.split("/").map(Number);
		const pct = max ? Math.round((remaining / max) * 100) : undefined;
		// Informational: the watchdog and preflight both consume this bucket.
		return pass(rateLimit, `${tokens} remaining${pct !== undefined ? ` (${pct}%)` : ""}`, t(), {
			tokens,
			requestCost: cost,
			node: p.headers.get("x-dot-server") ?? undefined,
		});
	},
};

export const connectivityChecks: Check[] = [reachable, auth, versionAlignment, rateLimit];
