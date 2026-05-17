import { PageProps } from "@/types/page";
import { getSiteConfig } from "@/utils/site-config";
import { getAllIssues, getLatestIssue } from "@/utils/getDotCMSContent";
import { DefaultHeroBanner } from "@/components/shared/DefaultHeroBanner";
import { IssueAccordion } from "@/components/IssueAccordion";

export default async function ArchivesPage({ searchParams }: PageProps) {
	const sp = await searchParams;
	const { siteId } = await getSiteConfig(sp);

	const latestIssue = await getLatestIssue(siteId);
	const issues = await getAllIssues(siteId, latestIssue?.identifier);

	return (
		<>
			<DefaultHeroBanner title="ARCHIVES" />
			{issues ? (
				<div className="mx-auto max-w-3xl py-10">
					<IssueAccordion issues={issues} />
				</div>
			) : (
				<div className="py-8 text-center text-gray-500 font-bold">No issues found.</div>
			)}
		</>
	);
}
