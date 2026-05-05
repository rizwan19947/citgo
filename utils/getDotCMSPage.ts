import { cache } from "react";
import { dotCMSClient } from "./dotCMSClient";
import { DotCMSGraphQLParams } from "@dotcms/types";
import { DotCMSPageContent } from "@/types/page";

/*
 * Fetches a DotCMS page by its URL path, optionally with extra GraphQL queries
 * (e.g. navigation, related content). Wrapped in React's cache() so the same
 * path is only fetched once per server request — safe to call from multiple
 * components in the same render. Returns undefined on error (caller shows 404).
 */
export const getDotCMSPage = cache(
  async (path: string, graphql?: DotCMSGraphQLParams) => {
    try {
      const pageData = await dotCMSClient.page.get<{
        content: DotCMSPageContent;
      }>(path, graphql ? { graphql } : undefined);
      return pageData;
    } catch (e) {
      console.error("ERROR FETCHING PAGE: ", (e as Error).message);
    }
  },
);
