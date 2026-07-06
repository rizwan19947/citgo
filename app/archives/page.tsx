import type { Metadata } from "next";
import { PageProps } from "@/types/page";
import { getSiteConfig } from "@/utils/site-config";
import { getAllIssues, getLatestIssue } from "@/utils/getDotCMSContent";
import { DefaultHeroBanner } from "@/components/shared/DefaultHeroBanner";
import { IssueAccordion } from "@/components/IssueAccordion";

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
	const { hostname } = await getSiteConfig(await searchParams);
	return {
		title: "Archives",
		description: "Browse all past issues and articles.",
		alternates: { canonical: `https://${hostname}/archives` },
	};
}

export default async function ArchivesPage({ searchParams }: PageProps) {
	const sp = await searchParams;
	const { siteId } = await getSiteConfig(sp);

	const latestIssue = await getLatestIssue(siteId);
	const issues = await getAllIssues(siteId, latestIssue?.identifier);

	return (
		<>
			<DefaultHeroBanner title="Archives" />
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
