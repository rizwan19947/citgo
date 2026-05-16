"use client";

import { DotCMSLayoutBody, useEditableDotCMSPage } from "@dotcms/react";
import type { DotCMSComposedPageResponse, DotCMSPageResponse } from "@dotcms/types";
import { pageComponents } from "@/components/content-types";
import { UVESiteDetector } from "@/components/UVESiteDetector";

/*
 * Client-side page renderer. Wraps the raw DotCMS page data with
 * useEditableDotCMSPage so the page becomes live-editable inside the DotCMS UVE
 * page editor (changes in the editor reflect instantly without a reload).
 * DotCMSLayoutBody reads the page layout and renders each content block using
 * the matching component from pageComponents.
 */

interface PageProps {
	pageContent: DotCMSComposedPageResponse<DotCMSPageResponse>;
	serverHostname: string;
	siteIdMap: Record<string, string>;
}

export function Page({ pageContent, serverHostname, siteIdMap }: PageProps) {
	const { pageAsset } = useEditableDotCMSPage(pageContent);

	return (
		<>
			<UVESiteDetector serverHostname={serverHostname} siteIdMap={siteIdMap} />
			<DotCMSLayoutBody page={pageAsset} components={pageComponents} />
		</>
	);
}
