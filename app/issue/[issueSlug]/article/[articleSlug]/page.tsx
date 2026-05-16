import { notFound } from "next/navigation";
import { getSiteConfig } from "@/utils/site-config";
import { getArticleBySlugAndMatchByIssueSlug } from "@/utils/getDotCMSContent";
import Article from "@/components/content-types/Article";
import { ArticleFields } from "@/types/content-types";
import { Contentlet } from "@dotcms/types";

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
	const { siteId } = await getSiteConfig(sp);

	const article: Contentlet<Contentlet<ArticleFields>> | undefined =
		await getArticleBySlugAndMatchByIssueSlug(siteId, issueSlug, articleSlug);

	if (!article) {
		return notFound();
	}

	return <Article {...article} />;
}
