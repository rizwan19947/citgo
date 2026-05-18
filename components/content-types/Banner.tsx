import Image from "next/image";
import Link from "next/link";

import type { BannerContentlet } from "@/types/content-types";

import { DefaultHeroBanner } from "@/components/shared/DefaultHeroBanner";

export default function Banner({
	title,
	image,
	mobileImage,
	detail,
	issue,
	article,
}: BannerContentlet) {
	const relatedIssue = Array.isArray(issue) ? issue[0] : issue;
	const issueSlug = relatedIssue?.slug;
	const href =
		issueSlug && article?.slug ? `/issue/${issueSlug}/article/${article?.slug}` : undefined;
	const hasImage = typeof image === "string" && image.length > 0;
	const hasMobileImage = typeof mobileImage === "string" && mobileImage.length > 0;

	const inner = (
		<div className="relative w-full overflow-hidden min-h-[200px] md:min-h-[300px]">
			{hasImage ? (
				<Image
					src={`/dA/${image}`}
					alt={title || ""}
					width={0}
					height={0}
					sizes="100vw"
					quality={75}
					className={`h-auto w-full ${hasMobileImage ? "hidden md:block" : ""}`}
				/>
			) : (
				<DefaultHeroBanner title={title} />
			)}
			{hasMobileImage && (
				<Image
					src={`/dA/${mobileImage}`}
					alt={title || ""}
					width={0}
					height={0}
					sizes="100vw"
					quality={75}
					className="h-auto w-full md:hidden"
				/>
			)}
			{(title || detail) && (
				<div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/60 to-transparent p-6 md:p-10">
					{title && (
						<h2 className="text-2xl font-bold text-white md:text-4xl">{title}</h2>
					)}
					{detail && <p className="mt-2 text-lg text-white/90">{detail}</p>}
				</div>
			)}
		</div>
	);

	if (href) {
		return (
			<Link href={href} className="block">
				{inner}
			</Link>
		);
	}

	return inner;
}
