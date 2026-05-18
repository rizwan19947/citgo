"use client";

import Image from "next/image";
import Link from "next/link";
import { useEditableDotCMSPage } from "@dotcms/react";
import type { DotCMSComposedPageResponse, DotCMSPageResponse } from "@dotcms/types";
import { resolveImage } from "@/utils/resolveImage";
import type { ArticleContentlet, BannerContentlet, IssueContentlet } from "@/types/content-types";

interface HomePageProps {
	currentIssue: IssueContentlet;
	pageContent: DotCMSComposedPageResponse<DotCMSPageResponse>;
}

function SectionHeading({ children }: { children: React.ReactNode }) {
	return (
		<div className="flex items-center gap-4 my-12">
			<div className="flex-1 h-[2px] bg-[#C8102E]" />
			<h2 className="text-2xl md:text-3xl font-bold text-center uppercase whitespace-nowrap">
				{children}
			</h2>
			<div className="flex-1 h-[2px] bg-[#C8102E]" />
		</div>
	);
}

function HeroBanner({ banner, issueTitle }: { banner: BannerContentlet; issueTitle: string }) {
	const bgImage = resolveImage(banner.image);
	const article = Array.isArray(banner.article) ? banner.article[0] : banner.article;
	if (!article) return null;

	return (
		<div className="relative w-full min-h-[400px] md:min-h-[500px] flex items-center">
			{bgImage ? (
				<Image
					src={`/dA/${bgImage}`}
					alt=""
					fill
					quality={75}
					className="absolute inset-0 object-cover"
				/>
			) : (
				<div className="absolute inset-0 bg-[#C8102E]" />
			)}
			<div className="absolute inset-0" />
			<div className="relative z-10 max-w-7xl mx-8 md:mx-32 lg:mx-72 px-6 md:px-12 py-12 md:py-16">
				<p className="text-lg font-bold tracking-widest text-white text-shadow-lg uppercase mb-3">
					{issueTitle}
				</p>
				<h1 className="text-3xl md:text-5xl font-bold text-white max-w-xl text-shadow-lg leading-tight mb-4">
					{article.title}
				</h1>
				{article.teaser && (
					<p className="text-white/90 max-w-md text-sm md:text-base text-shadow-lg mb-6">
						{article.teaser}
					</p>
				)}
				<Link
					href={`/${article.issueSlug}/${article.slug}`}
					className="inline-block shadow-lg border-2 border-white text-white font-bold text-shadow-lg text-sm uppercase tracking-widest px-6 py-3 hover:bg-white hover:text-[#C8102E] transition-colors"
				>
					Read Article
				</Link>
			</div>
		</div>
	);
}

function FeaturedArticleCard({
	article,
	issueTitle,
}: {
	article: ArticleContentlet;
	issueTitle: string;
}) {
	const thumb = resolveImage(article.image);

	return (
		<div className="flex flex-col bg-white shadow-md rounded overflow-hidden">
			{thumb ? (
				<Image
					src={`/dA/${thumb}`}
					alt={article.title || ""}
					width={400}
					height={250}
					quality={75}
					className="w-full h-52 object-cover"
				/>
			) : (
				<div className="w-full h-52 bg-gray-200" />
			)}
			<div className="p-5 flex flex-col flex-1">
				<p className="text-xs font-bold text-[#C8102E] uppercase tracking-wide mb-1">
					{issueTitle}
				</p>
				<h3 className="font-bold text-lg leading-snug mb-2">{article.title}</h3>
				{article.teaser && (
					<p className="text-sm text-gray-600 mb-4 flex-1">{article.teaser}</p>
				)}
				<Link
					href={`/${article.issueSlug}/${article.slug}`}
					className="text-sm font-bold text-[#C8102E] uppercase hover:underline"
				>
					Read More &rsaquo;
				</Link>
			</div>
		</div>
	);
}

function AlsoInThisIssueCard({
	article,
	issueTitle,
}: {
	article: ArticleContentlet;
	issueTitle: string;
}) {
	const thumb = resolveImage(article.image);

	return (
		<div className="flex bg-white shadow-md rounded overflow-hidden">
			{thumb ? (
				<Image
					src={`/dA/${thumb}`}
					alt={article.title || ""}
					width={200}
					height={150}
					quality={75}
					className="w-40 md:w-48 shrink-0 object-cover"
				/>
			) : (
				<div className="w-40 md:w-48 shrink-0 bg-gray-200" />
			)}
			<div className="p-4 flex flex-col justify-center">
				<p className="text-xs font-bold text-[#C8102E] uppercase tracking-wide mb-1">
					{issueTitle}
				</p>
				<h3 className="font-bold text-base leading-snug mb-2">{article.title}</h3>
				<Link
					href={`/${article.issueSlug}/${article.slug}`}
					className="text-sm font-bold text-[#C8102E] uppercase hover:underline"
				>
					Read More &rsaquo;
				</Link>
			</div>
		</div>
	);
}

export function HomePage({ currentIssue, pageContent }: HomePageProps) {
	useEditableDotCMSPage(pageContent);
	const banner = Array.isArray(currentIssue.banner)
		? currentIssue.banner[0]
		: currentIssue.banner;
	const articles = currentIssue.articles ?? [];
	const featured = articles.filter((a) => a.featuredArticle);
	const remaining = articles.filter((a) => !a.featuredArticle);
	const issueTitle = currentIssue.title;

	return (
		<>
			{banner && <HeroBanner banner={banner} issueTitle={issueTitle} />}

			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				{featured.length > 0 && (
					<>
						<SectionHeading>Featured Articles</SectionHeading>
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
							{featured.map((article) => (
								<FeaturedArticleCard
									key={article.identifier}
									article={article}
									issueTitle={issueTitle}
								/>
							))}
						</div>
					</>
				)}

				{remaining.length > 0 && (
					<>
						<SectionHeading>Also In This Issue</SectionHeading>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
							{remaining.map((article) => (
								<AlsoInThisIssueCard
									key={article.identifier}
									article={article}
									issueTitle={issueTitle}
								/>
							))}
						</div>
					</>
				)}
			</div>
		</>
	);
}
