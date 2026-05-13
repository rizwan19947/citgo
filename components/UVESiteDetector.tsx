"use client";

import { useEffect, useRef } from "react";

interface UVESiteDetectorProps {
	serverHostname: string;
	siteIdMap: Record<string, string>; // siteId → hostname (values used as known-hosts check)
}

/**
 * Detects when the DotCMS UVE wants a different site than the one the server
 * rendered. Reads `pageAsset.site.hostName` from the UVE postMessage — this is
 * the site the editor actually wants. `requestMetadata.variables.siteId` is NOT
 * usable because it echoes back the frontend's own request, not the editor's intent.
 *
 * Only active inside the UVE iframe.
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

		const handler = (event: MessageEvent) => {
			if (switchingRef.current) return;

			const hostName = event.data?.payload?.pageAsset?.site?.hostName;

			if (!hostName || !knownHosts.has(hostName)) return;

			if (hostName !== serverHostname) {
				switchingRef.current = true;
				switchSite(hostName);
			}
		};

		window.addEventListener("message", handler);
		return () => window.removeEventListener("message", handler);
	}, [serverHostname, siteIdMap]);

	return null;
}
