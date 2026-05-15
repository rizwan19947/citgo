import { notFound } from "next/navigation";
import { getSiteConfig } from "@/utils/site-config";
import { getArticleBySlug } from "@/utils/getDotCMSContent";
import Article from "@/components/content-types/Article";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

/*
 * Article detail page — /issue/{issueSlug}/article/{articleSlug}
 * Fetches the article via the Content API (Approach C).
 */

interface ArticlePageProps {
	params: Promise<{ issueSlug: string; articleSlug: string }>;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ArticlePage({ params, searchParams }: ArticlePageProps) {
	const { issueSlug, articleSlug } = await params;
	const sp = await searchParams;
	const { siteId, assetSlug } = await getSiteConfig(sp);

	const article = await getArticleBySlug(siteId, issueSlug, articleSlug);

	if (!article) {
		return notFound();
	}

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
