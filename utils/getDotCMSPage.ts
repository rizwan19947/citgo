import { cache } from "react";
import { createClient } from "./dotCMSClient";
import type { DotCMSGraphQLParams } from "@dotcms/types";

/*
 * Fetches a DotCMS page by its URL path, optionally with extra GraphQL queries
 * (e.g. related content). Wrapped in React's cache() so the same path is only
 * fetched once per server request — safe to call from multiple components in
 * the same render. Returns undefined on error (caller shows 404).
 */
export const getDotCMSPage = cache(
	async (path: string, siteId: string, graphql?: DotCMSGraphQLParams) => {
		try {
			const client = createClient(siteId);
			const pageData = await client.page.get(path, graphql ? { graphql } : undefined);
			return pageData;
		} catch (e) {
			console.log("ERROR FETCHING PAGE DATA: ", (e as Error).message);
			console.log("WILL USE CONTENT API FOR ARTICLE DETAIL PAGES");
		}
	},
);
