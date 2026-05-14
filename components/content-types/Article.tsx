import Image from "next/image";
import ImageLoader from "@/utils/imageLoader";
import { DotCMSBlockEditorRenderer } from "@dotcms/react";
import type { BlockEditorNode } from "@dotcms/types";

interface ArticleProps {
	identifier: string;
	title?: string;
	slug?: string;
	teaser?: string;
	image?: string;
	mobileImage?: string;
	heroImage?: string;
	content?: BlockEditorNode;
	tags?: string | string[];
	[key: string]: unknown;
}

export default function Article({
	title,
	teaser,
	image,
	mobileImage,
	heroImage,
	content,
	tags,
}: ArticleProps) {
	const tagList = Array.isArray(tags) ? tags : tags ? [tags] : [];
	const displayImage = heroImage || image;

	return (
		<article data-component="Article">
			{displayImage && (
				<div className="relative w-full overflow-hidden">
					{mobileImage && (
						<Image
							src={`/dA/${mobileImage}`}
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
						className={`h-auto w-full ${mobileImage ? "hidden md:block" : ""}`}
					/>
				</div>
			)}
			<div className="mt-6">
				{title && <h1 className="text-3xl font-bold md:text-4xl">{title}</h1>}
				{teaser && <p className="mt-3 text-lg text-gray-600">{teaser}</p>}
			</div>
			{content && (
				<div className="prose prose-lg mt-6 max-w-none">
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
	);
}
