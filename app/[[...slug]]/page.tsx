import { notFound } from "next/navigation";
import { getDotCMSPage } from "@/utils/getDotCMSPage";
import { getSiteConfig, getSiteIdToHostnameMap } from "@/utils/site-config";
import { Page } from "@/views/Page";
import { PageProps } from "@/types/page";

/*
 * Catch-all route — handles DotCMS editor-composed pages (/, /about, etc.).
 * Content detail pages (articles, issues) are handled by dedicated routes.
 * Header and Footer are rendered by the root layout.
 */

function resolvePath(slug?: string[]): string {
	return `/${(slug ?? []).join("/")}`;
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

	return (
		<Page
			pageContent={pageContent}
			serverHostname={serverHostname}
			siteIdMap={getSiteIdToHostnameMap()}
		/>
	);
}
