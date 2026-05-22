"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { extractSnippet, extractText } from "@/utils/extractText";
import type { ArticleContentlet } from "@/types/content-types";

interface SearchResultsProps {
	initialQuery: string;
	siteId: string;
	hostname: string;
	currentIssueSlug?: string;
}

interface SearchResponse {
	results: ArticleContentlet[];
	total: number;
	page: number;
	pageSize: number;
}

function HighlightedText({ text, query }: { text: string; query: string }) {
	if (!query.trim()) return <>{text}</>;

	const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
	const parts = text.split(regex);

	return (
		<>
			{parts.map((part, i) =>
				regex.test(part) ? (
					<mark key={i} className="bg-yellow-300 px-0">
						{part}
					</mark>
				) : (
					<span key={i}>{part}</span>
				),
			)}
		</>
	);
}

export function SearchResults({
	initialQuery,
	siteId,
	hostname,
	currentIssueSlug,
}: SearchResultsProps) {
	const router = useRouter();
	const searchParams = useSearchParams();

	const [query, setQuery] = useState(initialQuery);
	const [activeQuery, setActiveQuery] = useState(initialQuery); // only updates on submit
	const [filter, setFilter] = useState<"current" | "archived">(
		(searchParams.get("filter") as "current" | "archived") || "current",
	);
	const [page, setPage] = useState(parseInt(searchParams.get("page") || "1", 10));
	const [data, setData] = useState<SearchResponse | null>(null);
	const [loading, setLoading] = useState(false);

	const fetchResults = useCallback(
		async (q: string, p: number, f: string) => {
			if (!q.trim()) {
				setData(null);
				return;
			}

			setLoading(true);
			try {
				const params = new URLSearchParams({
					q,
					siteId,
					page: String(p),
					filter: f,
					...(currentIssueSlug ? { currentIssueSlug } : {}),
				});
				const res = await fetch(`/api/search?${params}`);
				const json: SearchResponse = await res.json();
				setData(json);
			} catch {
				setData(null);
			} finally {
				setLoading(false);
			}
		},
		[siteId, currentIssueSlug],
	);

	// Fetch on mount and when filter/page changes
	useEffect(() => {
		fetchResults(activeQuery, page, filter);
	}, [page, filter]); // eslint-disable-line react-hooks/exhaustive-deps

	// Update URL when search params change
	useEffect(() => {
		const params = new URLSearchParams();
		if (activeQuery) params.set("q", activeQuery);
		if (filter !== "current") params.set("filter", filter);
		if (page > 1) params.set("page", String(page));
		router.replace(`/search?${params.toString()}`, { scroll: false });
	}, [activeQuery, filter, page, router]);

	const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setActiveQuery(query);
		setPage(1);
		fetchResults(query, 1, filter);
	};

	const handleFilterChange = (newFilter: "current" | "archived") => {
		setFilter(newFilter);
		setPage(1);
	};

	const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0;

	return (
		<div className="mx-auto max-w-4xl px-4 py-10">
			<h1 className="text-3xl font-bold text-center mb-8">Search Results</h1>

			{/* Search input */}
			<form onSubmit={handleSubmit} className="mb-6">
				<div className="relative">
					<input
						type="search"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="Search articles..."
						className="w-full border border-gray-300 rounded px-4 py-3 pr-12 text-base focus:outline-none focus:ring-2 focus:ring-[#b8292f]/40 focus:border-[#b8292f]"
					/>
					<button
						type="submit"
						className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
						aria-label="Search"
					>
						<svg
							className="w-5 h-5"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
							strokeWidth={2}
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								d="M21 21l-4.35-4.35M11 19a8 8 0 110-16 8 8 0 010 16z"
							/>
						</svg>
					</button>
				</div>
			</form>

			{/* Filter */}
			{currentIssueSlug && (
				<div className="flex items-center justify-center gap-6 mb-8 text-sm">
					<span className="font-bold tracking-wide uppercase">Filter By:</span>
					<label className="flex items-center gap-2 cursor-pointer">
						<input
							type="radio"
							name="filter"
							checked={filter === "current"}
							onChange={() => handleFilterChange("current")}
							className="accent-[#b8292f]"
						/>
						Current Issue
					</label>
					<label className="flex items-center gap-2 cursor-pointer">
						<input
							type="radio"
							name="filter"
							checked={filter === "archived"}
							onChange={() => handleFilterChange("archived")}
							className="accent-[#b8292f]"
						/>
						Archived Issues
					</label>
				</div>
			)}

			{/* Results count */}
			{!loading && data && activeQuery.trim() && (
				<h2 className="text-xl font-bold mb-6">
					{data.total} &thinsp; Results for &quot;
					<HighlightedText text={activeQuery} query={activeQuery} />
					&quot;
				</h2>
			)}

			{/* Loading */}
			{loading && <div className="py-8 text-center text-gray-500">Searching...</div>}

			{/* Results */}
			{!loading && data && data.results.length > 0 && (
				<div className="divide-y divide-gray-200">
					{data.results.map((article) => {
						const plainText = extractText(article.content);
						const snippet = extractSnippet(plainText, activeQuery);
						const articleUrl = `/${article.issueSlug}/${article.slug}`;

						return (
							<Link
								key={article.identifier}
								href={articleUrl}
								className="block py-6 hover:bg-gray-50 -mx-4 px-4 rounded"
							>
								<h3 className="text-lg font-bold text-gray-900">
									<HighlightedText text={article.title} query={activeQuery} />
								</h3>
								<p className="mt-2 text-sm text-gray-700 leading-relaxed">
									<HighlightedText text={snippet} query={activeQuery} />
								</p>
							</Link>
						);
					})}
				</div>
			)}

			{/* No results */}
			{!loading && data && data.results.length === 0 && activeQuery.trim() && (
				<div className="py-8 text-center text-gray-500">
					Sorry, nothing was found. Try searching again.
				</div>
			)}

			{/* Pagination */}
			{totalPages > 1 && (
				<nav className="flex items-center justify-center gap-2 mt-10 text-sm">
					<button
						onClick={() => setPage((p) => Math.max(1, p - 1))}
						disabled={page <= 1}
						className="px-2 py-1 text-blue-700 disabled:text-gray-300 hover:cursor-pointer hover:underline"
						aria-label="Previous page"
					>
						&#9664;
					</button>

					{Array.from({ length: Math.min(totalPages, 9) }, (_, i) => {
						let pageNum: number;
						if (totalPages <= 9) {
							pageNum = i + 1;
						} else if (page <= 5) {
							pageNum = i + 1;
						} else if (page >= totalPages - 4) {
							pageNum = totalPages - 8 + i;
						} else {
							pageNum = page - 4 + i;
						}

						return (
							<button
								key={pageNum}
								onClick={() => setPage(pageNum)}
								className={`px-3 py-1 rounded ${
									pageNum === page
										? "font-bold text-gray-900"
										: "text-blue-700 hover:cursor-pointer hover:underline"
								}`}
							>
								{pageNum}
							</button>
						);
					})}

					{totalPages > 9 && page < totalPages - 4 && (
						<>
							<span className="px-1">...</span>
							<button
								onClick={() => setPage(totalPages)}
								className="px-3 py-1 text-blue-700 hover:cursor-pointer hover:underline"
							>
								{totalPages}
							</button>
						</>
					)}

					<button
						onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
						disabled={page >= totalPages}
						className="px-2 py-1 text-blue-700 disabled:text-gray-300 hover:cursor-pointer hover:underline"
						aria-label="Next page"
					>
						&#9654;
					</button>
				</nav>
			)}
		</div>
	);
}
