import { cache } from "react";
import { createClient } from "./dotCMSClient";
import { ArticleFields, FooterContentFields, IssueFields } from "@/types/content-types";
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
 * Fetches a single Article by its slug, then verifies if the issueSlug matches or not.
 */
export const getArticleBySlugAndMatchByIssueSlug = cache(
	async (siteId: string, issueSlug: string, articleSlug: string) => {
		try {
			const client = createClient(siteId);
			const response = await client.content
				.getCollection<Contentlet<ArticleFields>>("Article")
				.limit(1)
				.query(`+Article.slug:"${escapeLucene(articleSlug)}" +live:true`)
				.depth(1)
				.language(1);

			const article = response.contentlets[0];
			if (!article || article.issueSlug !== issueSlug) {
				return undefined;
			}

			return article;
		} catch (e) {
			console.error("ERROR FETCHING ARTICLE:", (e as Error).message);
			return undefined;
		}
	},
);

export const getIssueBySlug = cache(async (siteId: string, issueSlug: string) => {
	try {
		const client = createClient(siteId);
		const response = await client.content
			.getCollection<Contentlet<IssueFields>>("Issue")
			.limit(1)
			.query(`+Issue.slug:"${escapeLucene(issueSlug)}" +live:true`)
			.depth(1)
			.language(1);

		const issue = response.contentlets[0];

		if (!issue || issue.slug !== issueSlug) {
			return undefined;
		}

		return issue;
	} catch (e) {
		console.error("ERROR FETCHING ISSUE:", (e as Error).message);
		return undefined;
	}
});

export const getLatestIssue = cache(async (siteId: string) => {
	try {
		const client = createClient(siteId);
		const response = await client.content
			.getCollection<Contentlet<IssueFields>>("Issue")
			.limit(1)
			.sortBy([{ field: "Issue.publishDate", order: "desc" }])
			.query("+live:true")
			.depth(2)
			.language(1);

		return response.contentlets[0] ?? undefined;
	} catch (e) {
		console.error("ERROR FETCHING LATEST ISSUE:", (e as Error).message);
		return undefined;
	}
});

export const getAllIssues = cache(async (siteId: string, excludeIdentifier?: string) => {
	try {
		const client = createClient(siteId);
		const excludeClause = excludeIdentifier ? ` -identifier:${excludeIdentifier}` : "";
		const response = await client.content
			.getCollection<Contentlet<IssueFields>>("Issue")
			.query(`+live:true${excludeClause}`)
			.depth(1)
			.language(1);

		return response.total > 0 ? response.contentlets : undefined;
	} catch (e) {
		console.error("ERROR FETCHING ISSUES:", (e as Error).message);
		return undefined;
	}
});

export const getFooterContent = cache(async (siteId: string) => {
	try {
		const client = createClient(siteId);
		const response = await client.content
			.getCollection<Contentlet<FooterContentFields>>("FooterContent")
			.limit(1)
			.query(`+live:true`)
			.depth(1)
			.language(1);

		return response.contentlets[0] ?? undefined;
	} catch (e) {
		console.error("ERROR FETCHING FOOTER CONTENT:", (e as Error).message);
		return undefined;
	}
});

export const getArticlesByTitle = cache(async (siteId: string, title: string) => {
	try {
		const client = createClient(siteId);
		const response = await client.content
			.getCollection<Contentlet<ArticleFields>>("Article")
			.query(`+Article.title:"${escapeLucene(title)}" +live:true`)
			.depth(1)
			.language(1);

		return response.contentlets ?? undefined;
	} catch (e) {
		console.error("ERROR FETCHING ARTICLES:", (e as Error).message);
		return undefined;
	}
});
