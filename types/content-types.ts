import type { BlockEditorNode, Contentlet } from "@dotcms/types";

export interface BannerFields {
	title: string;
	image?: string;
	mobileImage?: string;
	detail?: string;
	articleSlug?: string;
	issue?: IssueContentlet[];
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
}

export type BannerContentlet = Contentlet<BannerFields>;
export type FooterContentContentlet = Contentlet<FooterContentFields>;
export type IssueContentlet = Contentlet<IssueFields>;
export type ArticleContentlet = Contentlet<ArticleFields>;
