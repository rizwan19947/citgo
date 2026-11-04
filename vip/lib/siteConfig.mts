/* Node type-stripping: erasable syntax only — no enum, namespace, or parameter properties. See assertions/types.mts. */
import type { SiteEntry } from "../assertions/types.mts";

/*
 * Parses SITE_N exactly the way utils/site-config.ts does — including its stopping behaviour and
 * its lack of trimming, because detecting both is the point.
 *
 * The app's loop is `while (process.env[`SITE_${i}`]) { ... i++ }`, so it halts at the first missing
 * index: SITE_1 + SITE_3 with no SITE_2 means SITE_3 is silently dropped. It also splits on "|" and
 * uses the parts as they are, so "citgonow.com |id|slug" makes a site keyed "citgonow.com " that no
 * request ever matches. We scan a wider range, mark which entries the app would see, and keep the
 * parts untrimmed.
 */

const SCAN_LIMIT = 24;

export interface ParsedSites {
	sites: SiteEntry[];
	rawSiteKeys: string[];
	/** Indices present in the environment but unreachable because of an earlier gap. */
	droppedByGap: number[];
}

export function parseSites(env: Record<string, string | undefined>): ParsedSites {
	const rawSiteKeys: string[] = [];
	const present: number[] = [];

	for (let i = 1; i <= SCAN_LIMIT; i++) {
		if (env[`SITE_${i}`]) {
			rawSiteKeys.push(`SITE_${i}`);
			present.push(i);
		}
	}

	// Mirror the app's loop: it stops at the first index it cannot find.
	let reachableUpTo = 0;
	while (env[`SITE_${reachableUpTo + 1}`]) reachableUpTo++;

	const sites: SiteEntry[] = present.map((index) => {
		const raw = env[`SITE_${index}`]!;
		const [hostname = "", siteId = "", assetSlug = ""] = raw.split("|");
		return { index, raw, hostname, siteId, assetSlug, visibleToApp: index <= reachableUpTo };
	});

	return {
		sites,
		rawSiteKeys,
		droppedByGap: present.filter((i) => i > reachableUpTo),
	};
}
