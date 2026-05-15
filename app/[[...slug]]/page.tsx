import { notFound } from "next/navigation";
import { getDotCMSPage } from "@/utils/getDotCMSPage";
import { getSiteConfig, getSiteIdToHostnameMap } from "@/utils/site-config";
import { Page } from "@/views/Page";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

/*
 * Catch-all route — handles DotCMS editor-composed pages (/, /about, etc.).
 * Content detail pages (articles, issues) are handled by dedicated routes.
 */

interface PageProps {
	params: Promise<{ slug?: string[] }>;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function resolvePath(slug?: string[]): string {
	return `/${(slug ?? []).join("/")}`;
}

export default async function CatchAllPage({ params, searchParams }: PageProps) {
	const { slug } = await params;
	const sp = await searchParams;
	const path = resolvePath(slug);
	const { siteId, assetSlug, hostname: serverHostname } = await getSiteConfig(sp);

	const pageContent = await getDotCMSPage(path, siteId);

	if (!pageContent) {
		return notFound();
	}

	const layout = pageContent.pageAsset?.layout;

	return (
		<>
			{layout?.header && <Header assetSlug={assetSlug} />}
			<Page
				pageContent={pageContent}
				serverHostname={serverHostname}
				siteIdMap={getSiteIdToHostnameMap()}
			/>
			{layout?.footer && <Footer assetSlug={assetSlug} />}
		</>
	);
}
