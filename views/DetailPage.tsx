"use client";

import { useEffect } from "react";
import { useEditableDotCMSPage } from "@dotcms/react";
import type { DotCMSComposedPageResponse, DotCMSPageResponse } from "@dotcms/types";
import type { IssueContentlet } from "@/types/content-types";
import Article from "@/components/content-types/Article";

/*
 * Detail page renderer for URL-mapped content.
 * When DotCMS resolves a URL map, the matched contentlet is returned in
 * pageAsset.urlContentMap. This component reads the content type and
 * renders the appropriate detail component.
 *
 * Wraps with useEditableDotCMSPage so content is live-editable in UVE.
 */

const detailComponents: Record<string, React.ComponentType<any>> = {
	Article,
};

interface DetailPageProps {
	pageContent: DotCMSComposedPageResponse<DotCMSPageResponse>;
	issue?: IssueContentlet;
}

export function DetailPage({ pageContent, issue }: DetailPageProps) {
	const { pageAsset } = useEditableDotCMSPage(pageContent);
	const contentMap = pageAsset.urlContentMap;

	useEffect(() => {
		const isInUVE = typeof window !== "undefined" && window.parent !== window;
		if (isInUVE) {
			document.body.classList.add("dotcms-uve-active");
			return () => document.body.classList.remove("dotcms-uve-active");
		}
	}, []);

	const contentType = contentMap?.contentType as string | undefined;
	const Component = contentType ? detailComponents[contentType] : undefined;

	if (!Component) {
		return null;
	}

	return <Component contentlet={contentMap} issue={issue} />;
}
