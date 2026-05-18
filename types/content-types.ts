import type { BlockEditorNode, Contentlet } from "@dotcms/types";

export interface BannerFields {
	title: string;
	image?: string;
	mobileImage?: string;
	detail?: string;
	issue?: IssueContentlet;
	article?: ArticleContentlet;
}

export interface FooterContentFields {
	title?: string;
	content?: BlockEditorNode;
	showNewsletterLinks?: boolean | string;
}

export interface IssueFields {
	title: string;
	slug: string;
	publishDate?: string;
	expireDate?: string;
	image?: string;
	articles?: ArticleContentlet[];
	banner?: BannerContentlet;
}

export interface ArticleFields {
	title: string;
	slug: string;
	teaser?: string;
	issueSlug: string;
	image?: string;
	mobileImage?: string;
	content?: BlockEditorNode;
	tags?: string | string[];
	featuredArticle?: boolean;
}

export type BannerContentlet = Contentlet<BannerFields>;
export type FooterContentContentlet = Contentlet<FooterContentFields>;
export type IssueContentlet = Contentlet<IssueFields>;
export type ArticleContentlet = Contentlet<ArticleFields>;
