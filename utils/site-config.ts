import { headers, cookies } from "next/headers"

interface SiteConfig {
	siteId: string
	assetSlug: string
}

const SITE_CONFIGS: Record<string, SiteConfig> = {
	"citgonow.com": {
		siteId: process.env.CITGO_NOW_IDENTIFIER ?? "",
		assetSlug: "citgonow",
	},
	"citgonowlubes.com": {
		siteId: process.env.CITGO_LUBES_IDENTIFIER ?? "",
		assetSlug: "citgolubes",
	},
	"citgoretailconnections.com": {
		siteId: process.env.CITGO_RETAIL_IDENTIFIER ?? "",
		assetSlug: "citgoretail",
	},
}

const DEFAULT_HOST = "citgoretailconnections.com"

export async function getSiteConfig(
	searchParams?: Record<string, string | string[] | undefined>
): Promise<SiteConfig> {
	// 1. Dev/deploy override
	if (process.env.FRONTEND_HOST_OVERRIDE) {
		return SITE_CONFIGS[process.env.FRONTEND_HOST_OVERRIDE]
	}

	// 2. Host header match (production DNS routing)
	const h = await headers()
	const host = h.get("host")?.replace(/:\d+$/, "") ?? ""
	if (SITE_CONFIGS[host]) {
		return SITE_CONFIGS[host]
	}

	// 3. UVE site from query parameter (set by UVESiteDetector on reload)
	const siteFromParams =
		typeof searchParams?.dotcms_site === "string"
			? searchParams.dotcms_site
			: undefined
	if (siteFromParams && SITE_CONFIGS[siteFromParams]) {
		return SITE_CONFIGS[siteFromParams]
	}

	// 4. UVE site from cookie (persists across UVE navigations)
	const c = await cookies()
	const siteFromCookie = c.get("dotcms-uve-site")?.value
	if (siteFromCookie && SITE_CONFIGS[siteFromCookie]) {
		return SITE_CONFIGS[siteFromCookie]
	}

	// 5. Default
	return SITE_CONFIGS[DEFAULT_HOST]
}

//TODO Remove Later
export async function getSiteHost(): Promise<string> {
	const h = await headers()
	const host = h.get("host")?.replace(/:\d+$/, "") ?? DEFAULT_HOST
	return host
}
