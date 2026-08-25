import type { NextConfig } from "next";

const isDev = process.env.ENVIRONMENT === "development";
const nextConfig: NextConfig = {
	...(isDev ? { assetPrefix: "http://localhost:3000" } : {}),
	allowedDevOrigins: ["*", "citgonow.com", "citgonowlubes.com", "citgoretailconnections.com"],
	images: {
		loader: "custom",
		loaderFile: "./utils/imageLoader.ts",
	},
	// Absorb/override chrome devtools probe
	async rewrites() {
		return [
			{
				source: "/.well-known/appspecific/:path*",
				destination: "/api/devtools-stub",
			},
		];
	},
};

export default nextConfig;
