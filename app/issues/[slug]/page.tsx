import { notFound } from "next/navigation";
import { getDotCMSPage } from "@/utils/getDotCMSPage";
import { getIssueBySlug } from "@/utils/getDotCMSContent";
import { getSiteConfig } from "@/utils/site-config";
import { HomePage } from "@/components/HomePage";

interface IssuePageProps {
	params: Promise<{ slug: string }>;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ArchivedIssuePage({ params, searchParams }: IssuePageProps) {
	const { slug } = await params;
	const sp = await searchParams;
	const { siteId } = await getSiteConfig(sp);

	const [pageContent, issue] = await Promise.all([
		getDotCMSPage("/", siteId),
		getIssueBySlug(siteId, slug),
	]);

	if (!issue || !pageContent) {
		return notFound();
	}

	return <HomePage currentIssue={issue} pageContent={pageContent} />;
}
