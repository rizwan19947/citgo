import { MetadataRoute } from "next";

// Internal paths only - indexing on/off lives in the layout's SITE_INDEXING gate, not here.
export default function robots(): MetadataRoute.Robots {
	return {
		rules: [
			{
				userAgent: "*",
				allow: "/",
				disallow: ["/api/", "/dA/", "/dotAdmin/", "/preview/"],
			},
		],
	};
}
