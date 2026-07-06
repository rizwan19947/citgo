import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDotCMSPage } from "@/utils/getDotCMSPage";
import { getAllIssues, getIssueBySlug, getLatestIssue } from "@/utils/getDotCMSContent";
import { getSiteConfig, getSiteIdToHostnameMap } from "@/utils/site-config";
import {
	errorMetadata,
	getMetadataFromPage,
	getMetadataFromUrlContentMap,
} from "@/utils/getMetadata";
import { Page } from "@/views/Page";
import { DetailPage } from "@/views/DetailPage";
import { HomePage } from "@/components/HomePage";
import { PageProps } from "@/types/page";

/*
 * Catch-all route — handles all DotCMS-managed pages.
 *
 * Regular pages (/, /about, etc.) → Page view (DotCMSLayoutBody)
 * URL-mapped content (/{issueSlug}/{articleSlug}) → DetailPage view
 *
 * Header and Footer are rendered by the root layout.
 */

function resolvePath(slug?: string[]): string {
	return `/${(slug ?? []).join("/")}`;
}

function hasUrlContentMap(urlContentMap?: Record<string, unknown>): boolean {
	return !!urlContentMap && Object.keys(urlContentMap).length > 0;
}

// Shares the page component's fetch via React cache() — no extra API call.
export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
	const { slug } = await params;
	const path = resolvePath(slug);
	const { siteId, hostname } = await getSiteConfig(await searchParams);
	const pageContent = await getDotCMSPage(path, siteId);

	if (!pageContent) return errorMetadata;

	const { pageAsset } = pageContent;
	const urlContentMap = pageAsset.urlContentMap;

	return urlContentMap && hasUrlContentMap(urlContentMap as unknown as Record<string, unknown>)
		? getMetadataFromUrlContentMap(urlContentMap, hostname, path)
		: getMetadataFromPage(pageAsset.page, hostname, path);
}

export default async function CatchAllPage({ params, searchParams }: PageProps) {
	const { slug } = await params;
	const sp = await searchParams;
	const path = resolvePath(slug);
	const { siteId, hostname: serverHostname } = await getSiteConfig(sp);

	const [pageContent, currentIssue] = await Promise.all([
		getDotCMSPage(path, siteId),
		getLatestIssue(siteId),
	]);

	if (!pageContent) {
		return notFound();
	}

	if (path === "/" && currentIssue) {
		return <HomePage currentIssue={currentIssue} pageContent={pageContent} />;
	}

	if (
		hasUrlContentMap(pageContent.pageAsset.urlContentMap as unknown as Record<string, unknown>)
	) {
		const contentMap = pageContent.pageAsset.urlContentMap as unknown as Record<string, unknown>;
		const issueSlug = contentMap.issueSlug as string | undefined;
		const [issue, archivedIssues] = await Promise.all([
			issueSlug ? getIssueBySlug(siteId, issueSlug) : undefined,
			getAllIssues(siteId, currentIssue?.identifier),
		]);

		return <DetailPage pageContent={pageContent} issue={issue} archivedIssues={archivedIssues} />;
	}

	return (
		<Page
			pageContent={pageContent}
			serverHostname={serverHostname}
			siteIdMap={getSiteIdToHostnameMap()}
			currentIssue={currentIssue}
		/>
	);
}
