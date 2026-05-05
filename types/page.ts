import type { DotCMSNavigationItem } from "@dotcms/types";

/*
 * TypeScript types for the extra GraphQL content fetched alongside a page.
 *
 * DotCMSPageNavigation — a nav item that also carries its children array.
 * DotCMSPageContent    — shape of the `content` field returned by getDotCMSPage;
 *                        extend this interface as you add more GraphQL queries.
 */

export interface DotCMSPageNavigation extends DotCMSNavigationItem {
  children: DotCMSNavigationItem[];
}

export interface DotCMSPageContent {
  navigation: DotCMSPageNavigation;
}
