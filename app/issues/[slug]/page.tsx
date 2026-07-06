import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDotCMSPage } from "@/utils/getDotCMSPage";
import { getIssueBySlug } from "@/utils/getDotCMSContent";
import { getSiteConfig } from "@/utils/site-config";
import { errorMetadata, getMetadataFromIssue } from "@/utils/getMetadata";
import { HomePage } from "@/components/HomePage";

interface IssuePageProps {
	params: Promise<{ slug: string }>;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({
	params,
	searchParams,
}: IssuePageProps): Promise<Metadata> {
	const { slug } = await params;
	const { siteId, hostname } = await getSiteConfig(await searchParams);
	const issue = await getIssueBySlug(siteId, slug);

	if (!issue) return errorMetadata;

	return getMetadataFromIssue(issue, hostname, `/issues/${slug}`);
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
