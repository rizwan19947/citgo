import Image from "next/image";
import ImageLoader from "@/utils/imageLoader";
import { DotCMSBlockEditorRenderer, DotCMSEditableText } from "@dotcms/react";
import type { ArticleContentlet, IssueContentlet } from "@/types/content-types";
import { DefaultHeroBanner } from "@/components/shared/DefaultHeroBanner";

function resolveImage(field: unknown): string | undefined {
	if (typeof field === "string" && field.length > 0) return field;
	if (field && typeof field === "object") {
		const obj = field as Record<string, unknown>;
		if ("idPath" in obj && typeof obj.idPath === "string") return obj.idPath;
		if ("identifier" in obj && typeof obj.identifier === "string") return obj.identifier;
	}
	return undefined;
}

/*
 * Article detail component.
 * Accepts either { contentlet } (from DetailPage) or spread props (from DotCMSLayoutBody).
 * When a contentlet reference is available, text fields use DotCMSEditableText for UVE inline editing.
 */

type ArticleProps = { contentlet: ArticleContentlet; issue?: IssueContentlet } | ArticleContentlet;

function getContentlet(props: ArticleProps): ArticleContentlet {
	return "contentlet" in props ? props.contentlet : props;
}

export default function Article(props: ArticleProps) {
	const contentlet = getContentlet(props);
	const { title, teaser, image, mobileImage, content, tags } = contentlet;
	const tagList = Array.isArray(tags) ? tags : tags ? [tags] : [];
	const displayImage = resolveImage(image);
	const resolvedMobileImage = resolveImage(mobileImage);
	const isEditable = "contentlet" in props;
	const issue = "contentlet" in props ? props.issue : undefined;

	// console.warn(contentlet);
	// console.warn(issue);
	console.warn(displayImage);

	return (
		<>
			<DefaultHeroBanner title={title} volumeTitle={issue?.title} />
			<div
				data-component="Article"
				className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-8 mx-auto max-w-6xl"
			>
				<article>
					{displayImage && (
						<div className="relative w-full overflow-hidden">
							{resolvedMobileImage && (
								<Image
									src={`/dA/${resolvedMobileImage}`}
									loader={ImageLoader}
									alt={title || ""}
									width={0}
									height={0}
									sizes="100vw"
									quality={75}
									className="h-auto w-full md:hidden"
								/>
							)}
							<Image
								src={`/dA/${displayImage}`}
								loader={ImageLoader}
								alt={title || ""}
								width={0}
								height={0}
								sizes="(max-width: 768px) 100vw, 1200px"
								quality={75}
								className={`h-auto w-full ${resolvedMobileImage ? "hidden md:block" : ""}`}
							/>
						</div>
					)}
					<div className="mt-6">
						<h1 className="text-3xl font-bold md:text-4xl">
							{isEditable ? (
								<DotCMSEditableText
									contentlet={contentlet}
									fieldName="title"
									mode="plain"
								/>
							) : (
								title
							)}
						</h1>
						{teaser && (
							<p className="mt-3 text-lg text-gray-600">
								{isEditable ? (
									<DotCMSEditableText
										contentlet={contentlet}
										fieldName="teaser"
										mode="minimal"
									/>
								) : (
									teaser
								)}
							</p>
						)}
					</div>
					{content && (
						<div
							className="prose prose-lg mt-6 max-w-none"
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
					{tagList.length > 0 && (
						<div className="mt-8 flex flex-wrap gap-2">
							{tagList.map((tag) => (
								<span
									key={tag}
									className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700"
								>
									{tag}
								</span>
							))}
						</div>
					)}
				</article>

				<aside className="md:mt-6">
					<h2 className="text-xl font-bold uppercase">Also In This Issue</h2>
					{/* TODO: populate with sibling articles from the same issue */}
				</aside>
			</div>
		</>
	);
}
