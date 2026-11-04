/* Node type-stripping: erasable syntax only — no enum, namespace, or parameter properties. See assertions/types.mts. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Check, CheckContext } from "./types.mts";
import { fail, pass, skip, timer } from "./types.mts";

/*
 * Reachability, auth, and version drift since handover.
 *
 * Every request here is a read against the client's live dev system, which is rate-limited, so this
 * module makes exactly one authenticated call and reuses its headers for the version check.
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

/**
 * Installed @dotcms/client version. package-lock.json first, so it works from a bare checkout;
 * node_modules as the fallback for other package managers.
 */
function installedSdkVersion(repoRoot: string): string | undefined {
	try {
		const lock = JSON.parse(readFileSync(join(repoRoot, "package-lock.json"), "utf8"));
		const version = lock?.packages?.["node_modules/@dotcms/client"]?.version;
		if (typeof version === "string") return version;
	} catch {
		// No lockfile — fall through to the installed package.
	}
	try {
		return JSON.parse(readFileSync(join(repoRoot, "node_modules/@dotcms/client/package.json"), "utf8")).version;
	} catch {
		return undefined;
	}
}

interface Baseline {
	sdk?: string;
	dotcms?: string;
}

function readBaseline(repoRoot: string): Baseline | undefined {
	try {
		return JSON.parse(readFileSync(join(repoRoot, "vip/baseline.json"), "utf8"));
	} catch {
		return undefined;
	}
}

const versionBaseline: Check = {
	id: "dotcms.version-baseline",
	label: "SDK and dotCMS versions match the handover baseline",
	severity: "warn",
	async run(ctx) {
		const t = timer();
		const p = await probe(ctx);
		if (p instanceof Error) return skip(versionBaseline, "Skipped — host unreachable", t());

		const dotcms = p.headers.get("x-dotcms-version") ?? undefined;
		if (!dotcms) return skip(versionBaseline, "Skipped — dotCMS sent no x-dotcms-version header", t());
		const sdk = installedSdkVersion(ctx.repoRoot);
		if (!sdk) return skip(versionBaseline, "Skipped — can't find the installed @dotcms/client version", t());
		const baseline = readBaseline(ctx.repoRoot);
		if (!baseline?.sdk || !baseline?.dotcms) {
			return skip(versionBaseline, "Skipped — no vip/baseline.json with the handover versions", t());
		}

		// The versions present at handover are the supported ones (D13). Any change is worth a look:
		// typically the client upgraded dotCMS while the site's SDK stayed pinned.
		const changes: string[] = [];
		if (dotcms !== baseline.dotcms) changes.push(`dotCMS ${baseline.dotcms} → ${dotcms}`);
		if (sdk !== baseline.sdk) changes.push(`SDK ${baseline.sdk} → ${sdk}`);
		const detail = { sdk, dotcms, baseline };
		return changes.length
			? fail(
					versionBaseline,
					`Changed since handover: ${changes.join(", ")}. Test the site, then update vip/baseline.json`,
					t(),
					detail,
				)
			: pass(versionBaseline, `SDK ${sdk} and dotCMS ${dotcms} match the handover baseline`, t(), detail);
	},
};

export const connectivityChecks: Check[] = [reachable, auth, versionBaseline];
