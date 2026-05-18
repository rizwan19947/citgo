import type { ArticleContentlet } from "@/types/content-types";

export async function searchArticles(
	query: string,
	siteId: string,
): Promise<ArticleContentlet[]> {
	const res = await fetch(
		`/api/search?q=${encodeURIComponent(query)}&siteId=${siteId}`,
	);
	const data = await res.json();
	return data.results ?? [];
}
