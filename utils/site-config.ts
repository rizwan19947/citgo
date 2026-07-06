import { cookies, headers } from "next/headers";

interface SiteConfig {
	siteId: string;
	assetSlug: string;
}

/**
 * When deployingn a new site, all that is needed is to add a new environment variable
 * corresponding to the site in the format: SITE_1=<hostname>|<siteId>|<assetSlug>
 */
function buildSiteConfigs(): Record<string, SiteConfig> {
	const configs: Record<string, SiteConfig> = {};
	let i = 1;
	while (process.env[`SITE_${i}`]) {
		const [hostname, siteId, assetSlug] = process.env[`SITE_${i}`]!.split("|");
		configs[hostname] = { siteId, assetSlug };
		i++;
	}
	return configs;
}

const SITE_CONFIGS: Record<string, SiteConfig> = buildSiteConfigs();

const DEFAULT_HOST = process.env.DEFAULT_SITE_HOST ?? "";

/** Reverse map: siteId → hostname. Used client-side by UVESiteDetector */
export function getSiteIdToHostnameMap(): Record<string, string> {
	const map: Record<string, string> = {};
	for (const [hostname, config] of Object.entries(SITE_CONFIGS)) {
		if (config.siteId) map[config.siteId] = hostname;
	}
	return map;
}

export async function getSiteConfig(
	searchParams?: Record<string, string | string[] | undefined>,
): Promise<SiteConfig & { hostname: string }> {
	const resolve = (key: string) => ({ ...SITE_CONFIGS[key], hostname: key });

	/**
	 * There are 4 flows for the site config to be resolved:
	 */

	// 1. Dev/deploy override
	if (process.env.FRONTEND_HOST_OVERRIDE) {
		return resolve(process.env.FRONTEND_HOST_OVERRIDE);
	}

	// 2. Host header match (production DNS routing)
	const h = await headers();
	const host = h.get("host")?.replace(/:\d+$/, "") ?? "";
	if (SITE_CONFIGS[host]) {
		return resolve(host);
	}

	// 3. UVE site from query parameter (set by UVESiteDetector on reload)
	const siteFromParams =
		typeof searchParams?.dotcms_site === "string" ? searchParams.dotcms_site : undefined;
	if (siteFromParams && SITE_CONFIGS[siteFromParams]) {
		return resolve(siteFromParams);
	}

	// 4. UVE site from cookie (persists across UVE navigations)
	const c = await cookies();
	const siteFromCookie = c.get("dotcms-uve-site")?.value;
	if (siteFromCookie && SITE_CONFIGS[siteFromCookie]) {
		return resolve(siteFromCookie);
	}

	// 5. Default
	return resolve(DEFAULT_HOST);
}
