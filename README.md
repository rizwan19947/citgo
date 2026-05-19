# CITGO Newsletters — Headless DotCMS Frontend

A multi-site headless CMS frontend serving three CITGO newsletter properties from a single Next.js deployment. DotCMS provides content management and the Universal Visual Editor (UVE); this app fetches pages and content via the DotCMS SDK and renders them with React.

**Sites served:** citgonow.com, citgonowlubes.com, citgoretailconnections.com

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Prerequisites](#prerequisites)
3. [Environment Variables](#environment-variables)
4. [Getting Started](#getting-started)
5. [Project Structure](#project-structure)
6. [Multi-Site Architecture](#multi-site-architecture)
7. [Routing & Page Resolution](#routing--page-resolution)
8. [Content Types & Component Registry](#content-types--component-registry)
9. [Image Handling](#image-handling)
10. [Search](#search)
11. [Live Editing (UVE)](#live-editing-uve)
12. [Adding a New Content Type](#adding-a-new-content-type)
13. [Adding a New Site](#adding-a-new-site)

---

## Tech Stack

| Package | Version | Purpose |
|---|---|---|
| Next.js | 16 | App Router, SSR, API routes |
| React | 19 | UI library |
| @dotcms/client | 1.4.0 | DotCMS Content/Page API client |
| @dotcms/react | 1.4.0 | `DotCMSLayoutBody`, `DotCMSEditableText`, `useEditableDotCMSPage` |
| @dotcms/uve | 1.4.0 | UVE subscription helpers (site switching) |
| @dotcms/types | 1.4.0 | Shared TypeScript types |
| Tailwind CSS | 4 | Utility-first styling |
| shadcn/ui | 4 | Accordion (archives page) |
| TypeScript | 5 | Static typing |

---

## Prerequisites

- Node.js 18+
- npm
- A running DotCMS instance with published pages and content

---

## Environment Variables

Create a `.env.local` file:

```env
# DotCMS instance URL (server-side only — no NEXT_PUBLIC_ prefix)
DOTCMS_HOST=https://your-dotcms-instance.com
DOTCMS_AUTH_TOKEN=your-api-token

# Multi-site config — one per site, pipe-delimited: hostname|siteIdentifier|assetSlug
SITE_1=citgonow.com|abc123|citgonow
SITE_2=citgonowlubes.com|def456|citgolubes
SITE_3=citgoretailconnections.com|ghi789|citgoretail

# Fallback hostname when no match is found
DEFAULT_SITE_HOST=citgonow.com

# (Optional) Force a specific site during local dev
FRONTEND_HOST_OVERRIDE=citgonow.com
```

### Variable breakdown

| Variable | Purpose |
|---|---|
| `DOTCMS_HOST` | Base URL of the DotCMS instance. Server-side only. |
| `DOTCMS_AUTH_TOKEN` | API token (generate in DotCMS under User Tools > API Tokens). Server-side only. |
| `SITE_N` | Site definition: `hostname|siteIdentifier|assetSlug`. The `siteIdentifier` is the DotCMS site identifier (not the inode). The `assetSlug` maps to the folder under `public/assets/` for static site-specific assets (logos, etc). |
| `DEFAULT_SITE_HOST` | Hostname to fall back to when the incoming request doesn't match any configured site. |
| `FRONTEND_HOST_OVERRIDE` | When set, all requests resolve to this site regardless of Host header. Useful for local development. |

---

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Set `FRONTEND_HOST_OVERRIDE` to control which site you see locally.

```bash
# Production
npm run build
npm start
```

---

## Project Structure

```
├── app/
│   ├── layout.tsx                 # Root layout — Header, Footer, UVEBodyClass
│   ├── not-found.tsx              # 404 page
│   ├── globals.css                # Tailwind config, UVE styles, prose overrides
│   ├── [[...slug]]/
│   │   └── page.tsx               # Catch-all route — all DotCMS pages
│   ├── archives/
│   │   └── page.tsx               # Archives page — lists past issues
│   ├── api/
│   │   └── search/route.ts        # Article search API (Lucene query)
│   └── dA/[...path]/
│       └── route.ts               # Asset proxy — forwards /dA/* to DotCMS
│
├── views/
│   ├── Page.tsx                   # Generic DotCMS page (DotCMSLayoutBody + UVE)
│   └── DetailPage.tsx             # URL-mapped content detail page (Article)
│
├── components/
│   ├── Header.tsx                 # Site header — nav, search, mobile menu
│   ├── Footer.tsx                 # Site footer — block editor content, legal links
│   ├── HomePage.tsx               # Custom home page — hero banner, article cards
│   ├── IssueAccordion.tsx         # Expandable issue list (archives page)
│   ├── UVEBodyClass.tsx           # Adds .dotcms-uve-active class inside UVE iframe
│   ├── UVESiteDetector.tsx        # Detects UVE site switches and reloads
│   ├── content-types/
│   │   ├── index.ts               # Component registry (contentType → component)
│   │   ├── Article.tsx            # Article detail view
│   │   ├── Banner.tsx             # Banner content type (container-based pages)
│   │   ├── FooterContent.tsx      # Footer block editor content
│   │   └── Issue.tsx              # Issue content type
│   ├── shared/
│   │   └── DefaultHeroBanner.tsx  # Reusable red triangle hero banner
│   └── ui/
│       ├── accordion.tsx          # shadcn accordion
│       └── button.tsx             # shadcn button
│
├── utils/
│   ├── dotCMSClient.ts            # Creates a DotCMS API client for a given siteId
│   ├── getDotCMSPage.ts           # Fetches a page by URL path (React cache'd)
│   ├── getDotCMSContent.ts        # Content API queries (issues, articles, footer)
│   ├── queries.ts                 # GraphQL fragments (navigation tree)
│   ├── site-config.ts             # Multi-site resolution (host, cookie, override)
│   ├── imageLoader.ts             # Custom Next.js image loader for DotCMS assets
│   ├── resolveImage.ts            # Normalizes image field → identifier string
│   └── searchArticles.ts          # Client-side search helper (calls /api/search)
│
├── types/
│   ├── content-types.ts           # TypeScript interfaces for all DotCMS content types
│   └── page.ts                    # Page-level types (PageProps, navigation)
│
├── public/assets/
│   ├── citgonow/                  # Site-specific static assets (header-logo.svg)
│   ├── citgolubes/
│   ├── citgoretail/
│   └── global/                    # Shared assets (footer logo)
│
├── next.config.ts                 # Asset prefix, allowed origins, custom image loader
└── docs/
    └── content-types.md           # DotCMS field type → React rendering reference
```

---

## Multi-Site Architecture

A single deployment serves all three newsletter sites. Site resolution happens per-request in `utils/site-config.ts`, checked in this order:

1. **`FRONTEND_HOST_OVERRIDE`** env var (dev/deploy override)
2. **Host header** match against configured `SITE_N` hostnames (production DNS routing)
3. **`dotcms_site` query parameter** (set by `UVESiteDetector` during UVE site switches)
4. **`dotcms-uve-site` cookie** (persists UVE site choice across navigations)
5. **`DEFAULT_SITE_HOST`** fallback

The resolved `siteId` is passed to every DotCMS API call. Each site has its own content, issues, and articles in DotCMS — the frontend code is shared.

The `assetSlug` determines which folder under `public/assets/` is used for static assets like the header logo (`/assets/{assetSlug}/header-logo.svg`).

---

## Routing & Page Resolution

All routing goes through the catch-all route at `app/[[...slug]]/page.tsx`.

```
Request for /some/path
        │
        ▼
Resolve site from Host header / cookie / env
        │
        ▼
Fetch DotCMS page + latest issue in parallel
        │
        ├── path === "/" && has issue → HomePage (custom layout)
        ├── page has urlContentMap       → DetailPage (URL-mapped content)
        └── otherwise                    → Page (DotCMSLayoutBody)
```

### Three rendering paths

| Path | View | Description |
|---|---|---|
| `/` | `HomePage` | Custom layout with hero banner, featured articles, and article cards. Data comes from the latest Issue contentlet and its relationships. |
| `/{issueSlug}/{articleSlug}` | `DetailPage` | URL-mapped content. DotCMS resolves the URL map and returns the matched contentlet in `pageAsset.urlContentMap`. Rendered with the `Article` component. |
| Everything else | `Page` | Generic DotCMS page. `DotCMSLayoutBody` reads the page layout and renders each container's contentlets using the component registry. |

### Dedicated routes

| Route | Description |
|---|---|
| `/archives` | Lists all past issues with expandable article lists (accordion). |
| `/api/search` | Server-side article search. Accepts `?q=term&siteId=id`, returns matching articles via Lucene query. |
| `/dA/[...path]` | Asset proxy. Forwards `/dA/*` requests to the DotCMS instance with auth, enabling image loading without exposing the DotCMS host to the client. |

---

## Content Types & Component Registry

Content types are registered in `components/content-types/index.ts`:

```ts
export const pageComponents = {
  Banner: Banner,
  FooterContent: FooterContent,
  Issue: Issue,
  Article: Article,
};
```

The key must exactly match the Content Type Variable name in DotCMS (case-sensitive). `DotCMSLayoutBody` looks up each contentlet's `contentType` in this map and renders the matching component, passing the full contentlet as props.

### Content model

```
Issue (1)
  ├── banner (1) → Banner
  │     └── article (1) → Article   (hero article)
  └── articles (N) → Article        (all articles in the issue)

Article
  ├── title, slug, teaser, issueSlug
  ├── image, mobileImage (binary/file)
  ├── content (Block Editor)
  ├── tags
  └── featuredArticle (boolean)

FooterContent
  ├── title
  ├── content (Block Editor)
  └── showNewsletterLinks (boolean)
```

TypeScript interfaces for all content types live in `types/content-types.ts`.

For a full reference on how different DotCMS field types map to React rendering, see `docs/content-types.md`.

---

## Image Handling

Images are handled globally via a custom Next.js image loader configured in `next.config.ts`:

```ts
images: {
  loader: "custom",
  loaderFile: "./utils/imageLoader.ts",
}
```

This means all `<Image>` components automatically use the loader — no need to pass a `loader` prop. The loader:

- Routes through the `/dA/` asset proxy
- Appends DotCMS transformation parameters (`/{width}maxw/{quality}q`)
- Applies adaptive quality based on viewport width (lower quality for smaller screens)
- Passes through external URLs, GIFs, and SVGs unchanged

Usage:

```tsx
<Image src={`/dA/${identifier}`} width={800} height={600} alt="..." />
```

The `resolveImage()` utility (`utils/resolveImage.ts`) normalizes DotCMS image fields — whether they come back as a string, or an object with `idPath` or `identifier` — into a consistent identifier string.

---

## Search

The header includes a debounced search input that queries articles by title.

**Client side:** `utils/searchArticles.ts` calls `/api/search?q=term&siteId=id`.

**Server side:** `app/api/search/route.ts` runs a Lucene wildcard query against the Article content type via the DotCMS Content API, returning up to 10 results.

Results appear in a dropdown with thumbnails and link to the article detail page.

---

## Live Editing (UVE)

The DotCMS Universal Visual Editor enables in-context editing. This app supports it on all page types:

### How it works

1. **`useEditableDotCMSPage(pageContent)`** is called in `Page.tsx`, `DetailPage.tsx`, and `HomePage.tsx`. This hook completes the postMessage handshake with the UVE iframe, enabling live content updates.

2. **`DotCMSEditableText`** wraps text fields to make them inline-editable in the UVE. Used on the home page (article titles, teasers) and article detail page (title).

3. **Block Editor editability** is enabled by adding `data-block-editor-content`, `data-inode`, `data-language`, `data-content-type`, and `data-field-name` attributes to the container element. Used in `Article.tsx` and `Footer.tsx`.

4. **`UVEBodyClass`** (root layout) adds the `dotcms-uve-active` CSS class to `<body>` when inside the UVE iframe. This enables UVE-specific styles globally (block editor borders/hover indicators).

5. **`UVESiteDetector`** listens for `CONTENT_CHANGES` events from the UVE. When an editor switches to a different site in the DotCMS backend, this component detects the hostname mismatch and reloads the page with the correct site context (via cookie + query parameter).

### UVE-specific CSS (`globals.css`)

```css
/* Blue border on block editor fields inside UVE */
.dotcms-uve-active [data-block-editor-content] { ... }

/* Hover highlight on block editor fields */
.dotcms-uve-active [data-block-editor-content]:hover { ... }
```

No extra DotCMS configuration is needed. Ensure `DOTCMS_HOST` points to the correct instance and the UVE app is installed.

---

## Adding a New Content Type

1. Define the field interface in `types/content-types.ts`:

```ts
export interface MyTypeFields {
  title: string;
  body?: BlockEditorNode;
}
export type MyTypeContentlet = Contentlet<MyTypeFields>;
```

2. Create `components/content-types/MyType.tsx`. Props are the full contentlet — destructure the fields you need:

```tsx
import type { MyTypeContentlet } from "@/types/content-types";

export default function MyType({ title, body }: MyTypeContentlet) {
  return <div>{title}</div>;
}
```

3. Register it in `components/content-types/index.ts`:

```ts
import MyType from "./MyType";

export const pageComponents = {
  // ...existing
  MyType: MyType,  // key must match the Content Type Variable name in DotCMS
};
```

The component will automatically render wherever that content type appears on a DotCMS page.

---

## Adding a New Site

1. Create the site in DotCMS and note its **site identifier** (not inode).

2. Add a new env var:

```env
SITE_4=newsite.com|siteIdentifier|newsite
```

3. Create `public/assets/newsite/header-logo.svg` with the site's logo.

4. Add the hostname to `allowedDevOrigins` in `next.config.ts`.

5. Configure DNS to point the new hostname to the deployment.

No code changes required — the multi-site config is entirely driven by environment variables.
