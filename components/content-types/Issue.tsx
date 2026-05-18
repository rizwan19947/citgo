import Image from "next/image";
import Link from "next/link";

import type { IssueContentlet } from "@/types/content-types";

export default function Issue({ title, slug, publishDate, image, articles }: IssueContentlet) {
	const formattedDate = publishDate
		? new Date(publishDate).toLocaleDateString("en-US", {
				year: "numeric",
				month: "long",
				day: "numeric",
			})
		: null;

	return (
		<div data-component="Issue">
			{image && (
				<Image
					src={`/dA/${image}`}

					alt={title || ""}
					width={0}
					height={0}
					sizes="(max-width: 768px) 100vw, 600px"
					quality={75}
					className="h-auto w-full"
				/>
			)}
			<div className="mt-4">
				{title && (
					<h2 className="text-2xl font-bold">
						{slug ? <Link href={`/issue/${slug}`}>{title}</Link> : title}
					</h2>
				)}
				{formattedDate && <p className="mt-1 text-sm text-gray-500">{formattedDate}</p>}
			</div>
			{articles && articles.length > 0 && (
				<ul className="mt-6 space-y-4">
					{articles.map((article) => (
						<li key={article.identifier}>
							<Link
								href={`/issue/${slug}/article/${article.slug}`}
								className="text-lg font-medium hover:underline"
							>
								{article.title}
							</Link>
							{article.teaser && (
								<p className="mt-1 text-sm text-gray-600">{article.teaser}</p>
							)}
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
