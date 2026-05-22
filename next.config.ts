import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";
const nextConfig: NextConfig = {
	...(isDev ? { assetPrefix: "http://localhost:3000" } : {}),
	allowedDevOrigins: ["*", "citgonow.com", "citgonowlubes.com", "citgoretailconnections.com"],
	images: {
		loader: "custom",
		loaderFile: "./utils/imageLoader.ts",
	},
};

export default nextConfig;
