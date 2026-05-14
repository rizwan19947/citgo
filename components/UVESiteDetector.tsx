"use client";

import { useEffect, useRef } from "react";
import { createUVESubscription } from "@dotcms/uve";
import { UVEEventType } from "@dotcms/types";

interface UVESiteDetectorProps {
	serverHostname: string;
	siteIdMap: Record<string, string>; // siteId → hostname (values used as known-hosts check)
}

/**
 * Detects when the DotCMS UVE wants a different site than the one the server
 * rendered. Uses the SDK's createUVESubscription to listen for CONTENT_CHANGES
 * events, which provide the site the editor is actually viewing via
 * pageAsset.site.hostname.
 *
 * Deferred by one tick to ensure initUVE (called by useEditableDotCMSPage)
 * has set up the internal message dispatcher first.
 *
 * Only active inside the UVE iframe; no-op in production.
 */
function switchSite(hostname: string) {
	document.cookie = `dotcms-uve-site=${encodeURIComponent(hostname)}; path=/; max-age=2592000; SameSite=None; Secure`;
	const url = new URL(window.location.href);
	url.searchParams.set("dotcms_site", hostname);
	window.location.href = url.toString();
}

export function UVESiteDetector({ serverHostname, siteIdMap }: UVESiteDetectorProps) {
	const switchingRef = useRef(false);

	useEffect(() => {
		if (typeof window === "undefined" || window.parent === window) return;

		switchingRef.current = false;
		const knownHosts = new Set(Object.values(siteIdMap));

		const subscription = createUVESubscription(
			UVEEventType.CONTENT_CHANGES,
			(pageResponse) => {
				if (switchingRef.current) return;

				const site = pageResponse.pageAsset?.site as unknown as
					| Record<string, unknown>
					| undefined;

				const hostname = (site?.hostName as string) ?? (site?.hostname as string);
				if (!hostname || !knownHosts.has(hostname)) return;

				if (hostname !== serverHostname) {
					switchingRef.current = true;
					switchSite(hostname);
				}
			},
		);

		return () => subscription.unsubscribe();
	}, [serverHostname, siteIdMap]);

	return null;
}
