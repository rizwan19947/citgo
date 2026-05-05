import { createDotCMSClient } from "@dotcms/client";

/*
 * Singleton DotCMS API client used throughout the app.
 * Reads connection details from environment variables — set these in .env.local:
 *   NEXT_PUBLIC_DOTCMS_HOST         — base URL of your DotCMS instance
 *   NEXT_PUBLIC_DOTCMS_AUTH_TOKEN   — API token for authentication
 *   NEXT_PUBLIC_DOTCMS_SITE_ID      — identifier of the site to serve content from
 */
export const dotCMSClient = createDotCMSClient({
  dotcmsUrl: process.env.NEXT_PUBLIC_DOTCMS_HOST ?? "",
  authToken: process.env.NEXT_PUBLIC_DOTCMS_AUTH_TOKEN ?? "",
  siteId: process.env.NEXT_PUBLIC_DOTCMS_SITE_ID ?? "",
});
