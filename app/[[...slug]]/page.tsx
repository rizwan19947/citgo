import { notFound } from "next/navigation";
import { getDotCMSPage } from "@/utils/getDotCMSPage";
import { getIssueBySlug } from "@/utils/getDotCMSContent";
import { getSiteConfig, getSiteIdToHostnameMap } from "@/utils/site-config";
import { Page } from "@/views/Page";
import { DetailPage } from "@/views/DetailPage";
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

export default async function CatchAllPage({ params, searchParams }: PageProps) {
	const { slug } = await params;
	const sp = await searchParams;
	const path = resolvePath(slug);
	const { siteId, hostname: serverHostname } = await getSiteConfig(sp);

	const pageContent = await getDotCMSPage(path, siteId);

	if (!pageContent) {
		return notFound();
	}

	if (
		hasUrlContentMap(pageContent.pageAsset.urlContentMap as unknown as Record<string, unknown>)
	) {
		const contentMap = pageContent.pageAsset.urlContentMap as unknown as Record<string, unknown>;
		const issueSlug = contentMap.issueSlug as string | undefined;
		const issue = issueSlug ? await getIssueBySlug(siteId, issueSlug) : undefined;

		return <DetailPage pageContent={pageContent} issue={issue} />;
	}

	return (
		<Page
			pageContent={pageContent}
			serverHostname={serverHostname}
			siteIdMap={getSiteIdToHostnameMap()}
		/>
	);
}
