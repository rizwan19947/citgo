# SEO — Handover Reference

State of the SEO implementation for citgonow.com, citgonowlubes.com, and citgoretailconnections.com. All three sites
share this behavior; every generated URL automatically uses the correct site's domain.

## The headline: the sites are not indexed

Per CITGO's direction, the sites are **hidden from search engines**. Every page carries
`<meta name="robots" content="noindex, nofollow">`.

This is enforced by an environment variable on each deployment:

| `SITE_INDEXING`            | Result                                                |
|----------------------------|-------------------------------------------------------|
| unset (the standard state) | Every page is `noindex` — invisible to search engines |
| `true`                     | Pages become indexable                                |

The default is fail-closed: a new deployment with no configuration is automatically non-indexed. Nothing needs to be
set or maintained to keep the sites out of Google.

**This does not disable the rest of the SEO output.** Search indexing and link sharing are independent — when an
article URL is pasted into an email, Slack, Teams, or LinkedIn, the preview card (title, description, image) is
generated from the OpenGraph tags below, which work regardless of `noindex`.

## What every page emits

All pages get: a `<title>` ending in `| CITGO`, a meta description, a canonical URL on the site's own domain, and
`noindex`. Article and issue pages additionally get full OpenGraph + Twitter card tags for link previews.

| Page                              | Title                                  | Description                           | Link-preview image  |
|-----------------------------------|----------------------------------------|---------------------------------------|---------------------|
| Article (`/{issue}/{article}`)    | Meta Title field, or the article title | Meta Description field, or the teaser | The article's image |
| Home (`/`)                        | The DotCMS page's title                | The DotCMS page's SEO description     | —                   |
| Archived issue (`/issues/{slug}`) | The issue title                        | "Articles from the … issue."          | The issue's image   |
| Archives (`/archives`)            | "Archives"                             | Static                                | —                   |
| Search (`/search`)                | "Search"                               | Static                                | —                   |
| 404                               | "Page Not Found"                       | —                                     | —                   |

Article pages also emit `article:published_time` / `article:modified_time` from the contentlet's publish/modified
dates.

## What content editors control

Articles have an **SEO tab** in DotCMS with two optional fields:

- **Meta Title** — overrides the `<title>` and link-preview title. Leave empty to use the article title.
- **Meta Description** — overrides the meta description and link-preview text. Leave empty to use the teaser.

Everything falls back sensibly, so both fields can stay empty and pages still get correct metadata. The **Keywords**
field on the same tab currently has no metadata effect (reserved for structured data if indexing is ever enabled).

The link-preview image is always the article's regular image field — there is no separate SEO image.

## robots.txt

Served at `/robots.txt` on every site. It blocks crawlers from internal endpoints only:

```
Disallow: /api/        (search API)
Disallow: /dA/         (asset proxy)
Disallow: /dotAdmin/   (CMS admin)
Disallow: /preview/
```

The rest of the site is deliberately left crawlable — keeping pages fetchable is what lets crawlers *see* the
`noindex` instruction. Do not change this to a blanket `Disallow: /`.

## If indexing is ever wanted

1. Set `SITE_INDEXING=true` in that site's deployment environment and redeploy — the `noindex` disappears.
2. Build the two pieces that were deliberately not built (a sitemap, and JSON-LD structured data for rich results),
   and add a `Sitemap:` line to robots.
3. Register each domain in Google Search Console and submit the sitemap.

## Key files

| File                                                                                                     | Role                                                                     |
|----------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------|
| `utils/getMetadata.ts`                                                                                   | Builds all metadata (articles, standard pages, issues, 404)              |
| `app/layout.tsx`                                                                                         | `metadataBase`, the `CITGO` title template, and the `SITE_INDEXING` gate | 
| `app/robots.ts`                                                                                          | robots.txt                                                               |
| `app/[[...slug]]/page.tsx`, `app/issues/[slug]/page.tsx`, `app/archives/page.tsx`, `app/search/page.tsx` | Per-route `generateMetadata()`                                           |
