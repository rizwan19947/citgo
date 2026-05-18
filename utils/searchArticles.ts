import type { ArticleContentlet } from "@/types/content-types";

export async function searchArticles(query: string, siteId: string): Promise<ArticleContentlet[]> {
	const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&siteId=${siteId}`);
	const data = await res.json();
	return data.results ?? [];
}

/**
 * Used by forms onSubmit in header - (form wrappers are used for better accessibility - nothing more)
 * @param e
 */
export const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
	e.preventDefault();
};
