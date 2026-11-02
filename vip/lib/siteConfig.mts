/* Node type-stripping: erasable syntax only — no enum, namespace, or parameter properties. See assertions/types.mts. */
import type { SiteEntry } from "../assertions/types.mts";

/*
 * Parses SITE_N the way utils/site-config.ts does — deliberately including its stopping behaviour,
 * because detecting that behaviour is the point.
 *
 * The app's loop is `while (process.env[`SITE_${i}`]) { ... i++ }`, so it halts at the first missing
 * index. SITE_1 + SITE_3 with no SITE_2 means SITE_3 is silently dropped and that site never
 * resolves. We scan a wider range and mark which entries the app would actually see.
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
		return {
			index,
			raw,
			hostname: hostname.trim(),
			siteId: siteId.trim(),
			assetSlug: assetSlug.trim(),
			visibleToApp: index <= reachableUpTo,
		};
	});

	return {
		sites,
		rawSiteKeys,
		droppedByGap: present.filter((i) => i > reachableUpTo),
	};
}

/**
 * dotCMS site identifiers are 32 hex characters with no dashes; inodes are dashed UUIDs.
 * README warns to use the identifier, and this is the cheap way to catch the confusion.
 */
export function looksLikeIdentifier(value: string): boolean {
	return /^[0-9a-f]{32}$/i.test(value);
}

export function looksLikeInode(value: string): boolean {
	return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
