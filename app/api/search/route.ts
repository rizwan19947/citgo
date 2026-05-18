import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/dotCMSClient";
import type { ArticleFields } from "@/types/content-types";
import type { Contentlet } from "@dotcms/types";

function escapeLucene(str: string): string {
	return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export async function GET(request: NextRequest) {
	const q = request.nextUrl.searchParams.get("q")?.trim();
	const siteId = request.nextUrl.searchParams.get("siteId");

	if (!q || !siteId) {
		return NextResponse.json({ results: [] });
	}

	try {
		const client = createClient(siteId);
		const response = await client.content
			.getCollection<Contentlet<ArticleFields>>("Article")
			.query(`+title:*${escapeLucene(q)}* +live:true`)
			.limit(10)
			.language(1);

		return NextResponse.json({ results: response.contentlets ?? [] });
	} catch (e) {
		console.error("SEARCH ERROR:", (e as Error).message);
		return NextResponse.json({ results: [] });
	}
}
