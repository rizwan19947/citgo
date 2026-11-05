import { NextRequest } from "next/server";

const DOTCMS_HOST = process.env.DOTCMS_HOST || "http://localhost:8080";
const AUTH_TOKEN = process.env.DOTCMS_AUTH_TOKEN || "";

export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ path: string[] }> },
) {
	const { path } = await params;
	const assetPath = `/dA/${path.join("/")}`;

	const res = await fetch(`${DOTCMS_HOST}${assetPath}`, {
		headers: {
			Authorization: `Bearer ${AUTH_TOKEN}`,
		},
		redirect: "follow",
	});

	if (!res.ok) {
		return new Response("Asset not found", { status: res.status });
	}

	const contentType = res.headers.get("content-type") || "application/octet-stream";
	// Pass on dotCMS's own cache header, or no-cache when it sends none. Long-term caching is left to
	// each site's CDN.
	const cacheControl = res.headers.get("cache-control") || "no-cache";

	return new Response(res.body, {
		status: 200,
		headers: {
			"Content-Type": contentType,
			"Cache-Control": cacheControl,
		},
	});
}
