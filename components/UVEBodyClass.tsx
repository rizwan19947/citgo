"use client";

import { useEffect } from "react";

/**
 * Adds the `dotcms-uve-active` class to <body> when rendered inside
 * the DotCMS UVE iframe. This enables UVE-specific CSS globally.
 */
export function UVEBodyClass() {
	useEffect(() => {
		if (window.parent !== window) {
			document.body.classList.add("dotcms-uve-active");
			return () => document.body.classList.remove("dotcms-uve-active");
		}
	}, []);

	return null;
}
