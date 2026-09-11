/* Node type-stripping: erasable syntax only — no enum, namespace, or parameter properties. See assertions/types.mts. */
import type { Check } from "./types.mts";
import { fail, pass, timer } from "./types.mts";
import { looksLikeIdentifier, looksLikeInode } from "../lib/siteConfig.mts";

/* Environment shape. All of these are pure — no network, no filesystem. */

const required: Check = {
	id: "env.required",
	label: "Required environment variables present",
	severity: "error",
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
	async run(ctx) {
		const t = timer();
		const bad = ctx.sites
			.filter((s) => s.raw.split("|").length !== 3 || !s.hostname || !s.siteId || !s.assetSlug)
			.map((s) => `SITE_${s.index}`);
		return bad.length
			? fail(siteFormat, `Malformed: ${bad.join(", ")} — expected three pipe-delimited parts`, t(), { bad })
			: pass(siteFormat, `${ctx.sites.length} entries well-formed`, t());
	},
};

const siteNumbering: Check = {
	id: "env.site-numbering",
	label: "SITE_N numbering has no gaps",
	severity: "error",
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

const siteIdentifierShape: Check = {
	id: "env.site-identifier-shape",
	label: "SITE_N uses site identifiers, not inodes",
	severity: "warn",
	async run(ctx) {
		const t = timer();
		// Identifiers are 32 hex with no dashes; inodes are dashed UUIDs. sites.resolve is the
		// authoritative check — this one catches the mistake before a network round-trip.
		const suspect = ctx.sites.filter((s) => !looksLikeIdentifier(s.siteId));
		if (!suspect.length) return pass(siteIdentifierShape, "All look like identifiers", t());
		return fail(
			siteIdentifierShape,
			suspect
				.map(
					(s) =>
						`SITE_${s.index} (${s.hostname}): ${looksLikeInode(s.siteId) ? "looks like an inode" : "unexpected shape"}`,
				)
				.join("; "),
			t(),
			{ suspect: suspect.map((s) => s.hostname) },
		);
	},
};

const frontendHostOverride: Check = {
	id: "env.frontend-host-override",
	label: "FRONTEND_HOST_OVERRIDE matches a configured site",
	severity: "error",
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
		// The documented silent failure: resolve() spreads an undefined config, yielding
		// { siteId: undefined }, and every dotCMS call then fails quietly with no error surfaced.
		return fail(
			frontendHostOverride,
			`"${override}" matches no SITE_N hostname. Site resolution yields siteId: undefined and ` +
				`every dotCMS call fails silently. Configured: ${ctx.sites.map((s) => s.hostname).join(", ") || "none"}`,
			t(),
			{ override, configured: ctx.sites.map((s) => s.hostname) },
		);
	},
};

const defaultSiteHost: Check = {
	id: "env.default-site-host",
	label: "DEFAULT_SITE_HOST matches a configured site",
	severity: "error",
	async run(ctx) {
		const t = timer();
		const fallback = ctx.env.DEFAULT_SITE_HOST;
		if (!fallback) return fail(defaultSiteHost, "DEFAULT_SITE_HOST is not set", t());
		const match = ctx.sites.find((s) => s.hostname === fallback);
		return match
			? pass(defaultSiteHost, `Falls back to ${fallback} (SITE_${match.index})`, t())
			: fail(
					defaultSiteHost,
					`"${fallback}" matches no SITE_N hostname — unmatched requests resolve to an undefined site`,
					t(),
					{ fallback },
				);
	},
};

export const envChecks: Check[] = [
	required,
	siteFormat,
	siteNumbering,
	siteIdentifierShape,
	frontendHostOverride,
	defaultSiteHost,
];
