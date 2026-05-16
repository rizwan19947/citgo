import { PageProps } from "@/types/page";
import { getSiteConfig } from "@/utils/site-config";
import { getAllIssues } from "@/utils/getDotCMSContent";
import { notFound } from "next/navigation";

export default async function ArchivesPage({ searchParams }: PageProps) {
	const sp = await searchParams;
	const { siteId } = await getSiteConfig(sp);

	const issues = await getAllIssues(siteId);

	if (!issues) {
		return notFound();
	}

	//TODO remove later
	console.warn(issues);

	return <div>Archives</div>;
}
