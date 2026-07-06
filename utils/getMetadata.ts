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
	publishDate?: string | number;
	modDate?: string | number;
}

// Contentlet dates arrive as epoch millis; OpenGraph needs ISO 8601.
function toISODate(value?: string | number): string | undefined {
	if (value == null || value === "") return undefined;
	const date = new Date(typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value);
	return isNaN(date.getTime()) ? undefined : date.toISOString();
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
	const publishedTime = toISODate(urlContent.publishDate);
	const modifiedTime = toISODate(urlContent.modDate);

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
			...(publishedTime ? { publishedTime } : {}),
			...(modifiedTime ? { modifiedTime } : {}),
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

// Archived issue pages (/issues/{slug}). The issue image doubles as the OG image.
export function getMetadataFromIssue(
	issue: { title?: string; image?: unknown },
	hostname: string,
	path: string,
): Metadata {
	const title = issue.title || DEFAULT_TITLE;
	const description = issue.title ? `Articles from the ${issue.title} issue.` : DEFAULT_DESCRIPTION;
	const imageId = resolveImage(issue.image);
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
			type: "website",
		},
		twitter: {
			card: "summary_large_image",
			title,
			description,
			images: ogImage ? [ogImage] : undefined,
		},
	};
}

export const errorMetadata: Metadata = {
	title: "Page Not Found",
	robots: { index: false, follow: false },
	alternates: { canonical: "/404" },
};
