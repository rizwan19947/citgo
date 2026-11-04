/* Node type-stripping: erasable syntax only — no enum, namespace, or parameter properties. See assertions/types.mts. */
import type { Check, SiteEntry } from "./types.mts";
import { fail, pass, timer } from "./types.mts";

/* Environment shape. All of these are pure — no network, no filesystem. */

/** Configured hostnames, quoted so a stray space is visible in the message. */
const quotedHosts = (sites: SiteEntry[]) => sites.map((s) => JSON.stringify(s.hostname)).join(", ") || "none";

const required: Check = {
	id: "env.required",
	label: "Required environment variables present",
	severity: "error",
	commands: ["doctor"],
	async run(ctx) {
		const t = timer();
		const missing = ["DOTCMS_HOST", "DOTCMS_AUTH_TOKEN", "DEFAULT_SITE_HOST"].filter(
			(k) => !ctx.env[k],
		);
		if (ctx.sites.length === 0) missing.push("SITE_1");
		return missing.length
			? fail(required, `Missing: ${missing.join(", ")}`, t(), { missing })
			: pass(required, `All present, ${ctx.sites.length} site(s) configured`, t());
	},
};

const siteFormat: Check = {
	id: "env.site-format",
	label: "SITE_N entries parse to hostname|siteId|assetSlug",
	severity: "error",
	commands: ["doctor"],
	async run(ctx) {
		const t = timer();
		const problems: string[] = [];
		for (const s of ctx.sites) {
			const parts = s.raw.split("|");
			if (parts.length !== 3 || parts.some((p) => !p.trim())) {
				problems.push(`SITE_${s.index}: expected three non-empty parts separated by "|"`);
			} else if (parts.some((p) => /\s/.test(p))) {
				// The app uses the parts as they are, so a stray space makes a site no request matches.
				problems.push(`SITE_${s.index}: contains spaces, which the app keeps — remove them`);
			}
		}
		return problems.length
			? fail(siteFormat, problems.join("; "), t(), { problems })
			: pass(siteFormat, `${ctx.sites.length} entries well-formed`, t());
	},
};

const siteNumbering: Check = {
	id: "env.site-numbering",
	label: "SITE_N numbering has no gaps",
	severity: "error",
	commands: ["doctor"],
	async run(ctx) {
		const t = timer();
		const dropped = ctx.sites.filter((s) => !s.visibleToApp);
		if (!dropped.length) return pass(siteNumbering, "Contiguous from SITE_1", t());
		// utils/site-config.ts halts its loop at the first missing index, so these never load.
		return fail(
			siteNumbering,
			`Gap in numbering silently drops ${dropped.map((s) => `SITE_${s.index}`).join(", ")} — ` +
				`the app's loop stops at the first missing index`,
			t(),
			{ dropped: dropped.map((s) => ({ key: `SITE_${s.index}`, hostname: s.hostname })) },
		);
	},
};

const frontendHostOverride: Check = {
	id: "env.frontend-host-override",
	label: "FRONTEND_HOST_OVERRIDE matches a configured site",
	severity: "error",
	commands: ["doctor"],
	async run(ctx) {
		const t = timer();
		const override = ctx.env.FRONTEND_HOST_OVERRIDE;
		if (!override) {
			return pass(frontendHostOverride, "Not set — resolving by Host header (shared deployment)", t());
		}
		const match = ctx.sites.find((s) => s.hostname === override);
		if (match) {
			return pass(frontendHostOverride, `Pinned to ${override} (SITE_${match.index})`, t());
		}
		// The app resolves an override it can't find to { siteId: undefined }. Content searches then
		// have no site limit and return every site's content: wrong content, never an error.
		return fail(
			frontendHostOverride,
			`"${override}" matches no SITE_N hostname, so the site gets no siteId and quietly shows ` +
				`wrong or empty content. Configured: ${quotedHosts(ctx.sites)}`,
			t(),
			{ override, configured: ctx.sites.map((s) => s.hostname) },
		);
	},
};

const defaultSiteHost: Check = {
	id: "env.default-site-host",
	label: "DEFAULT_SITE_HOST matches a configured site",
	severity: "error",
	commands: ["doctor"],
	async run(ctx) {
		const t = timer();
		const fallback = ctx.env.DEFAULT_SITE_HOST;
		if (!fallback) return fail(defaultSiteHost, "DEFAULT_SITE_HOST is not set", t());
		const match = ctx.sites.find((s) => s.hostname === fallback);
		return match
			? pass(defaultSiteHost, `Falls back to ${fallback} (SITE_${match.index})`, t())
			: fail(
					defaultSiteHost,
					`"${fallback}" matches no SITE_N hostname, so requests that match no site get no siteId ` +
						`and show wrong or empty content. Configured: ${quotedHosts(ctx.sites)}`,
					t(),
					{ fallback },
				);
	},
};

export const envChecks: Check[] = [
	required,
	siteFormat,
	siteNumbering,
	frontendHostOverride,
	defaultSiteHost,
];
