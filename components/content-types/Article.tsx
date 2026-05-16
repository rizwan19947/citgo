import Image from "next/image";
import ImageLoader from "@/utils/imageLoader";
import { DotCMSBlockEditorRenderer } from "@dotcms/react";
import type { ArticleContentlet } from "@/types/content-types";

function resolveImage(field: unknown): string | undefined {
	if (typeof field === "string" && field.length > 0) return field;
	if (field && typeof field === "object" && "idPath" in field) return (field as { idPath: string }).idPath;
	return undefined;
}

export default function Article({ title, teaser, image, mobileImage, heroImage, content, tags }: ArticleContentlet) {
	const tagList = Array.isArray(tags) ? tags : tags ? [tags] : [];
	const displayImage = resolveImage(heroImage) || resolveImage(image);
	const resolvedMobileImage = resolveImage(mobileImage);

	return (
		<article data-component="Article">
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
