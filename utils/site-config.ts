import { headers } from "next/headers"

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

const DEFAULT_HOST = process.env.DEFAULT_FRONTEND_HOST ?? "citgoretailconnections.com"

export async function getSiteConfig(): Promise<SiteConfig> {
	const h = await headers()
	const host = h.get("host")?.replace(/:\d+$/, "") ?? DEFAULT_HOST
	return SITE_CONFIGS[host] ?? SITE_CONFIGS[DEFAULT_HOST]
}

//TODO Remove Later
export async function getSiteHost(): Promise<string> {
	const h = await headers()
	const host = h.get("host")?.replace(/:\d+$/, "") ?? DEFAULT_HOST
	return host
}
