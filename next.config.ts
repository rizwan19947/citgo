import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";
const nextConfig: NextConfig = {
	assetPrefix: isDev ? "http://localhost:3000" : undefined,
	allowedDevOrigins: ["*", "citgonow.com", "citgonowlubes.com", "citgoretailconnections.com"],
};

export default nextConfig;
