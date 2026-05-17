import type { NextConfig } from "next"

const isDev = process.env.NODE_ENV === "development"
const dotcmsHost = process.env.DOTCMS_HOST || "http://localhost:8080"

const nextConfig: NextConfig = {
	assetPrefix: isDev ? "http://localhost:3000" : undefined,
	allowedDevOrigins: ["*", "citgonow.com", "citgonowlubes.com", "citgoretailconnections.com"],
	async rewrites() {
		return {
			beforeFiles: [
				{
					source: "/dA/:path*",
					destination: `${dotcmsHost}/dA/:path*`,
				},
				{
					source: "/contentAsset/image/:path*",
					destination: `${dotcmsHost}/contentAsset/image/:path*`,
				},
			],
			afterFiles: [],
			fallback: [],
		}
	},
}

export default nextConfig
