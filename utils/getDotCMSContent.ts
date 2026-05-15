import { cache } from "react";
import { createClient } from "./dotCMSClient";
import type { ArticleFields } from "@/types/content-types";
import type { Contentlet } from "@dotcms/types";

/*
 * Content API utilities for fetching DotCMS contentlets directly.
 * Used for listing pages (Approach B) and custom detail pages (Approach C)
 * where the Page API / URL maps are not used.
 */

function escapeLucene(str: string): string {
	return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * Fetches a single Article by its slug, then verifies the issueSlug matches.
 */
export const getArticleBySlug = cache(
	async (siteId: string, issueSlug: string, articleSlug: string) => {
		const client = createClient(siteId);
		const response = await client.content
			.getCollection<Contentlet<ArticleFields>>("Article")
			.limit(1)
			.query(
				`+Article.slug:"${escapeLucene(articleSlug)}" +live:true`,
			)
			.depth(1)
			.language(1);

		const article = response.contentlets[0];
		if (!article || article.issueSlug !== issueSlug) {
			return null;
		}

		return article;
	},
);
