import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/dotCMSClient";
import type { ArticleFields } from "@/types/content-types";
import type { Contentlet } from "@dotcms/types";

const PAGE_SIZE = 10;

function escapeLucene(str: string): string {
	return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export async function GET(request: NextRequest) {
	const q = request.nextUrl.searchParams.get("q")?.trim();
	const siteId = request.nextUrl.searchParams.get("siteId");
	const page = Math.max(1, parseInt(request.nextUrl.searchParams.get("page") || "1", 10));
	const filter = request.nextUrl.searchParams.get("filter"); // "current" | "archived"
	const currentIssueSlug = request.nextUrl.searchParams.get("currentIssueSlug");

	if (!q || !siteId) {
		return NextResponse.json({ results: [], total: 0 });
	}

	try {
		const client = createClient(siteId);
		const escaped = escapeLucene(q);

		// Search on title (primary) and content (secondary) simultaneously
		let query = `+(title:*${escaped}* Article.content:*${escaped}*) +live:true`;

		// Filter by current issue or archived issues
		if (filter === "current" && currentIssueSlug) {
			query += ` +Article.issueSlug:"${escapeLucene(currentIssueSlug)}"`;
		} else if (filter === "archived" && currentIssueSlug) {
			query += ` -Article.issueSlug:"${escapeLucene(currentIssueSlug)}"`;
		}

		const response = await client.content
			.getCollection<Contentlet<ArticleFields>>("Article")
			.query(query)
			.limit(PAGE_SIZE)
			.page(page)
			.language(1);

		return NextResponse.json({
			results: response.contentlets ?? [],
			total: response.total ?? 0,
			page,
			pageSize: PAGE_SIZE,
		});
	} catch (e) {
		console.error("SEARCH ERROR:", (e as Error).message);
		return NextResponse.json({ results: [], total: 0 });
	}
}
