import type { Metadata } from "next";
import { PageProps } from "@/types/page";
import { getSiteConfig } from "@/utils/site-config";
import { getLatestIssue } from "@/utils/getDotCMSContent";
import { SearchResults } from "@/components/SearchResults";

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
	const { hostname } = await getSiteConfig(await searchParams);
	return {
		title: "Search",
		description: "Search articles across current and archived issues.",
		robots: { index: false, follow: true },
		alternates: { canonical: `https://${hostname}/search` },
	};
}

export default async function SearchPage({ searchParams }: PageProps) {
	const sp = await searchParams;
	const { siteId, hostname } = await getSiteConfig(sp);
	const currentIssue = await getLatestIssue(siteId);

	const q = typeof sp.q === "string" ? sp.q : "";

	return (
		<SearchResults
			initialQuery={q}
			siteId={siteId}
			hostname={hostname}
			currentIssueSlug={currentIssue?.slug}
		/>
	);
}
