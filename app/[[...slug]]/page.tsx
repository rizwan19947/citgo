import { notFound } from "next/navigation";
import { getDotCMSPage } from "@/utils/getDotCMSPage";
import { getArticleBySlug } from "@/utils/getDotCMSContent";
import { getSiteConfig, getSiteIdToHostnameMap } from "@/utils/site-config";
import { Page } from "@/views/Page";
import Article from "@/components/content-types/Article";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

/*
 * Catch-all route — handles every URL in the app.
 *
 * 1. Try fetching a DotCMS page via the Page API (GraphQL).
 *    Handles regular editor-composed pages (/, /about, etc.).
 *
 * 2. If no page is found and the URL has two segments (/{issueSlug}/{articleSlug}),
 *    try fetching an Article via the Content API (Approach C).
 *
 * 3. If neither resolves, show 404.
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

	/* 1. Try DotCMS Page API first */
	const pageContent = await getDotCMSPage(path, siteId);

	if (pageContent) {
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

	/* 2. Try Content API for article detail pages (/{issueSlug}/{articleSlug}) */
	if (slug?.length === 2) {
		const [issueSlug, articleSlug] = slug;
		const article = await getArticleBySlug(siteId, issueSlug, articleSlug);

		if (article) {
			return (
				<>
					<Header assetSlug={assetSlug} />
					<main className="container mx-auto">
						<Article {...article} />
					</main>
					<Footer assetSlug={assetSlug} />
				</>
			);
		}
	}

	return notFound();
}
