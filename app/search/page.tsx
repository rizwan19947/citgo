import { PageProps } from "@/types/page";
import { getSiteConfig } from "@/utils/site-config";
import { getLatestIssue } from "@/utils/getDotCMSContent";
import { SearchResults } from "@/components/SearchResults";

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
