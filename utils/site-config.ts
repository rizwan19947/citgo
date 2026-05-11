import { headers } from "next/headers";

const SITE_CONFIGS: Record<string, string> = {
  "citgonow.com": process.env.CITGO_NOW_IDENTIFIER ?? "",
  "citgonowlubes.com": process.env.CITGO_LUBES_IDENTIFIER ?? "",
  "citgoretailconnections.com": process.env.CITGO_RETAIL_IDENTIFIER ?? "",
};

const DEFAULT_HOST = "citgoretailconnections.com";

export async function getSiteConfig(): Promise<string> {
  const h = await headers();
  const host = h.get("host")?.replace(/:\d+$/, "") ?? DEFAULT_HOST;
  return SITE_CONFIGS[host] ?? SITE_CONFIGS[DEFAULT_HOST];
}
