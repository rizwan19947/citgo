import { PageProps } from "@/types/page";
import { getSiteConfig } from "@/utils/site-config";
import { getAllIssues } from "@/utils/getDotCMSContent";
import { DefaultHeroBanner } from "@/components/shared/DefaultHeroBanner";

export default async function ArchivesPage({ searchParams }: PageProps) {
	const sp = await searchParams;
	const { siteId } = await getSiteConfig(sp);

	const issues = await getAllIssues(siteId);

	return (
		<>
			<DefaultHeroBanner title="ARCHIVES" />
			{issues ? (
				<div className="mx-auto max-w-3xl py-8">
					{issues.map((issue) => (
						<div
							key={issue.identifier}
							className="border-b border-gray-200 px-4 py-5 flex items-center justify-between"
						>
							<span className="text-lg font-bold capitalize">{issue.title}</span>
							<svg
								className="h-5 w-5 text-[#C8102E]"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
								strokeWidth={2}
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									d="M19 9l-7 7-7-7"
								/>
							</svg>
						</div>
					))}
				</div>
			) : (
				<div className="py-8 text-center text-gray-500 font-bold">No issues found.</div>
			)}
		</>
	);
}
