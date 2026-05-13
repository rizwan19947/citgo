"use client"

import { useEffect } from "react"

interface UVESiteDetectorProps {
	pageAsset: {
		site?: {
			identifier?: string
			hostname?: string
		}
	}
	serverSiteId: string
}

/**
 * Detects when the DotCMS UVE is showing a different site than the one the
 * server rendered. When a mismatch is found it persists the correct site
 * hostname in a cookie + query parameter and reloads the iframe so the
 * server can render the right site on the next pass.
 *
 * Only active inside the UVE iframe; no-op in production.
 */
export function UVESiteDetector({ pageAsset, serverSiteId }: UVESiteDetectorProps) {
	useEffect(() => {
		// Only run inside the UVE iframe
		if (typeof window === "undefined" || window.parent === window) return

		const siteId = pageAsset?.site?.identifier
		const hostname = pageAsset?.site?.hostname

		if (!siteId || !hostname || siteId === serverSiteId) return

		// Persist the correct site for future requests
		document.cookie = `dotcms-uve-site=${encodeURIComponent(hostname)}; path=/; max-age=2592000; SameSite=None; Secure`

		// Also add as a query param (fallback if third-party cookies are blocked)
		const url = new URL(window.location.href)
		url.searchParams.set("dotcms_site", hostname)
		window.location.href = url.toString()
	}, [pageAsset?.site?.identifier, serverSiteId])

	return null
}
