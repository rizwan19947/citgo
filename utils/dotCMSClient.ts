import { createDotCMSClient } from "@dotcms/client";

/*
 * Creates a DotCMS API client for the given site.
 * Connection details come from environment variables (without NEXT_PUBLIC_ prefix
 * so they stay server-side and are never bundled into client JS):
 *   DOTCMS_HOST       — base URL of your DotCMS instance
 *   DOTCMS_AUTH_TOKEN — API token for authentication
 *
 * The siteId is resolved per-request via getSiteConfig() so that different
 * hostnames can serve different DotCMS sites from a single deployment.
 */
export function createClient(siteId: string) {
  return createDotCMSClient({
    dotcmsUrl: process.env.DOTCMS_HOST ?? "",
    authToken: process.env.DOTCMS_AUTH_TOKEN ?? "",
    siteId,
  });
}
