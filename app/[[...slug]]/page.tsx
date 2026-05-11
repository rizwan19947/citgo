import { notFound } from "next/navigation";
import { getDotCMSPage } from "@/utils/getDotCMSPage";
import {getSiteConfig, getSiteHost} from "@/utils/site-config";
import { fragmentNav, navigationQuery } from "@/utils/queries";
import { Page } from "@/views/Page";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

/*
 * Catch-all route — handles every URL in the app (e.g. /, /about, /blog/post-1).
 * On each request it resolves the site from the hostname, fetches the matching
 * page from DotCMS, then renders Header, the page body, and Footer based on
 * the layout flags DotCMS returns.
 * If DotCMS returns nothing for the path, Next.js shows the 404 page.
 */

interface PageProps {
  params: Promise<{ slug?: string[] }>;
}

/*
 * Converts the slug array from Next.js params into a URL path string.
 * e.g. ["blog", "my-post"] → "/blog/my-post", undefined → "/"
 */
function resolvePath(slug?: string[]): string {
  return `/${(slug ?? []).join("/")}`;
}

export default async function CatchAllPage({ params }: PageProps) {
  const { slug } = await params;
  const path = resolvePath(slug);
  const { siteId, assetSlug } = await getSiteConfig();

  //TODO Remove Later
  const siteHost = await getSiteHost();

  /* Fetch the page data from DotCMS, including the nav tree via GraphQL. */
  const pageContent = await getDotCMSPage(path, siteId, {
    content: { navigation: navigationQuery },
    fragments: [fragmentNav],
  });

  console.warn(siteHost);

  if (!pageContent) return notFound();

  /* layout flags (header/footer) come from the DotCMS page layout config. */
  const layout = pageContent.pageAsset?.layout;
  /* Top-level nav children are passed to Header to build the navigation menu. */
  const navItems = pageContent.content?.navigation?.children ?? [];

  return (
    <>
      {layout?.header && <Header navItems={navItems} assetSlug={assetSlug} />}
      <pre>{siteHost}</pre>
      <Page pageContent={pageContent} />
      {layout?.footer && <Footer assetSlug={assetSlug} />}
    </>
  );
}
