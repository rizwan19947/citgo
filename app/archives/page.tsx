import { PageProps } from "@/types/page";
import { getSiteConfig } from "@/utils/site-config";
import { getAllIssues } from "@/utils/getDotCMSContent";
import { Button } from "@/components/ui/button";

export default async function ArchivesPage({ searchParams }: PageProps) {
	const sp = await searchParams;
	const { siteId } = await getSiteConfig(sp);

	const issues = await getAllIssues(siteId);

	if (!issues) {
		return <div>No Issues Found!</div>;
	}

	//TODO remove later
	console.warn(issues);

	return (
		<>
			<Button>Something Here</Button>
			<div>Archives</div>
		</>
	);
}
