import Image from "next/image";
import Link from "next/link";

import { resolveImage } from "@/utils/resolveImage";
import { DotCMSBlockEditorRenderer, DotCMSEditableText } from "@dotcms/react";
import { ArchivedIssueSelect } from "@/components/ArchivedIssueSelect";
import type { ArticleContentlet, IssueContentlet } from "@/types/content-types";
import { DefaultHeroBanner } from "@/components/shared/DefaultHeroBanner";

/*
 * Article detail component.
 * Accepts either { contentlet } (from DetailPage) or spread props (from DotCMSLayoutBody).
 * When a contentlet reference is available, text fields use DotCMSEditableText for UVE inline editing.
 */

type ArticleProps =
	| { contentlet: ArticleContentlet; issue?: IssueContentlet; archivedIssues?: IssueContentlet[] }
	| ArticleContentlet;

function getContentlet(props: ArticleProps): ArticleContentlet {
	return "contentlet" in props ? props.contentlet : props;
}

export default function Article(props: ArticleProps) {
	const contentlet = getContentlet(props);
	const { title, image, mobileImage, content, tags } = contentlet;
	const tagList = Array.isArray(tags) ? tags : tags ? [tags] : [];
	const displayImage = resolveImage(image);
	const resolvedMobileImage = resolveImage(mobileImage);
	const isEditable = "contentlet" in props;
	const issue = "contentlet" in props ? props.issue : undefined;
	const archivedIssues = "contentlet" in props ? props.archivedIssues : undefined;

	const siblingArticles = issue?.articles?.filter((a) => a.identifier !== contentlet.identifier);

	return (
		<>
			<DefaultHeroBanner
				title={title}
				volumeTitle={issue?.title}
				titleSlot={
					isEditable ? (
						<DotCMSEditableText
							contentlet={contentlet}
							fieldName="title"
							mode="plain"
						/>
					) : undefined
				}
			/>
			<div
				data-component="Article"
				className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-8 mx-auto max-w-6xl py-10"
			>
				<article>
					{content && (
						<div
							className="prose mt-6 max-w-none"
							{...(isEditable
								? {
										"data-block-editor-content": JSON.stringify(content),
										"data-inode": contentlet.inode,
										"data-language": String(contentlet.languageId ?? 1),
										"data-content-type": contentlet.contentType,
										"data-field-name": "content",
									}
								: {})}
						>
							<DotCMSBlockEditorRenderer blocks={content} />
						</div>
					)}
				</article>

				<aside className="md:mt-6 md:sticky md:top-6 md:self-start">
					<h2 className="text-xl font-bold uppercase pb-5">Also In This Issue</h2>
					{siblingArticles && siblingArticles.length > 0 && (
						<ul className="space-y-4">
							{siblingArticles.map((article) => {
								const thumb = resolveImage(article.image);
								return (
									<li key={article.identifier}>
										<Link
											href={`/${article.issueSlug}/${article.slug}`}
											className="group flex items-start gap-3 no-underline"
										>
											{thumb ? (
												<Image
													src={`/dA/${thumb}`}
													alt={article.title || ""}
													width={100}
													height={65}
													quality={75}
													className="shrink-0 object-cover"
												/>
											) : (
												<div className="shrink-0 w-[100px] h-[65px] bg-gray-200" />
											)}
											<span className="text-citgo-link font-medium leading-snug group-hover:text-black group-hover:underline">
												{article.title}
											</span>
										</Link>
									</li>
								);
							})}
						</ul>
					)}
					{archivedIssues && archivedIssues.length > 0 && (
						<ArchivedIssueSelect issues={archivedIssues} />
					)}
				</aside>
			</div>
		</>
	);
}
