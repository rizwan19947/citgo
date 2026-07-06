import type { Metadata } from "next";
import { resolveImage } from "./resolveImage";

/*
 * Metadata builders for generateMetadata() across routes.
 * Every function takes the resolved hostname so URLs land on the right site domain.
 */

const DEFAULT_TITLE = "CITGO";
const DEFAULT_DESCRIPTION = "CITGO Petroleum Corporation";

interface UrlContentMapFields {
	metaTitle?: string;
	metaDescription?: string;
	title?: string;
	teaser?: string;
	image?: unknown;
	publishDate?: string;
	modDate?: string;
}

interface PageFields {
	title?: string;
	friendlyName?: string;
	seodescription?: string;
	seokeywords?: string;
	canonicalUrl?: string;
}

// Article detail pages (urlContentMap). metaTitle/metaDescription fall back to title/teaser.
export function getMetadataFromUrlContentMap(
	urlContent: UrlContentMapFields,
	hostname: string,
	path: string,
): Metadata {
	const title = urlContent.metaTitle || urlContent.title || DEFAULT_TITLE;
	const description = urlContent.metaDescription || urlContent.teaser || DEFAULT_DESCRIPTION;
	const imageId = resolveImage(urlContent.image);
	const ogImage = imageId ? `https://${hostname}/dA/${imageId}/800maxw/75q` : undefined;

	return {
		title,
		description,
		alternates: { canonical: `https://${hostname}${path}` },
		openGraph: {
			title,
			description,
			url: `https://${hostname}${path}`,
			siteName: "CITGO",
			images: ogImage ? [{ url: ogImage, alt: title, width: 800, height: 600 }] : undefined,
			type: "article",
			...(urlContent.publishDate ? { publishedTime: urlContent.publishDate } : {}),
			...(urlContent.modDate ? { modifiedTime: urlContent.modDate } : {}),
		},
		twitter: {
			card: "summary_large_image",
			title,
			description,
			images: ogImage ? [ogImage] : undefined,
		},
	};
}

// Standard pages (htmlpageasset fields). A page-level canonicalUrl takes priority.
export function getMetadataFromPage(page: PageFields, hostname: string, path: string): Metadata {
	const title = page.title || DEFAULT_TITLE;
	const description = page.seodescription || page.friendlyName || DEFAULT_DESCRIPTION;

	return {
		title,
		description,
		keywords: page.seokeywords,
		alternates: { canonical: page.canonicalUrl || `https://${hostname}${path}` },
		openGraph: {
			title,
			description,
			url: `https://${hostname}${path}`,
			siteName: "CITGO",
			type: "website",
		},
		twitter: {
			card: "summary_large_image",
			title,
			description,
		},
	};
}

export const errorMetadata: Metadata = {
	title: "Page Not Found",
	robots: { index: false, follow: false },
	alternates: { canonical: "/404" },
};
