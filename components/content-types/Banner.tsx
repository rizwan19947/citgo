import Image from "next/image";
import Link from "next/link";
import ImageLoader from "@/utils/imageLoader";

interface BannerProps {
	identifier: string;
	title: string;
	image?: string;
	mobileImage?: string;
	detail?: string;
	articleSlug?: string;
	issue?: Record<string, unknown>[];
	[key: string]: unknown;
}

export default function Banner({
	title,
	image,
	mobileImage,
	detail,
	articleSlug,
	issue,
}: BannerProps) {
	const relatedIssue = Array.isArray(issue) ? issue[0] : issue;
	const issueSlug = (relatedIssue as Record<string, unknown>)?.slug as string | undefined;
	const href = issueSlug && articleSlug ? `/issue/${issueSlug}/${articleSlug}` : undefined;

	const inner = (
		<div className="relative w-full overflow-hidden">
			{image && (
				<Image
					src={`/dA/${image}`}
					loader={ImageLoader}
					alt={title || ""}
					width={0}
					height={0}
					sizes="100vw"
					quality={75}
					className={`h-auto w-full ${mobileImage ? "hidden md:block" : ""}`}
				/>
			)}
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
