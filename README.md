# CITGO Newsletters — Headless DotCMS Frontend

A multi-site headless CMS frontend serving three CITGO newsletter properties from a single Next.js codebase. DotCMS
provides content management and the Universal Visual Editor (UVE); this app fetches pages and content via the DotCMS SDK
and renders them with React. In production each site runs as **its own deployment**, pinned via
`FRONTEND_HOST_OVERRIDE`; a single shared deployment serving all sites is also supported (see
[Multi-Site Architecture](#multi-site-architecture)).

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
11. [Archived Issues](#archived-issues)
12. [Live Editing (UVE)](#live-editing-uve)
13. [Theming](#theming)
14. [Cookie Banner](#cookie-banner)
15. [Adding a New Content Type](#adding-a-new-content-type)
16. [Adding a New Site](#adding-a-new-site)

> **AI agents:** start with `AGENTS.md` (auto-loaded) for a condensed architecture + conventions overview, then use this
> README and the `docs/` deep-dives.

---

## Tech Stack

| Package        | Version | Purpose                                                           |
|----------------|---------|-------------------------------------------------------------------|
| Next.js        | 16      | App Router, SSR, API routes                                       |
| React          | 19      | UI library                                                        |
| @dotcms/client | 1.4.0   | DotCMS Content/Page API client                                    |
| @dotcms/react  | 1.4.0   | `DotCMSLayoutBody`, `DotCMSEditableText`, `useEditableDotCMSPage` |
| @dotcms/uve    | 1.4.0   | UVE subscription helpers (site switching)                         |
| @dotcms/types  | 1.4.0   | Shared TypeScript types                                           |
| Tailwind CSS   | 4       | Utility-first styling                                             |
| shadcn/ui      | 4       | Accordion (archives page)                                         |
| TypeScript     | 5       | Static typing                                                     |
| Univers LT Std | —       | Self-hosted UI font (`next/font/local`, weights 300/400/700/900 + italics) |

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

# Pin this deployment to one site (required on per-site production deployments;
# optional convenience in local dev)
FRONTEND_HOST_OVERRIDE=citgonow.com
```

### Variable breakdown

| Variable                 | Purpose                                                                                              |
|--------------------------|------------------------------------------------------------------------------------------------------|
| `DOTCMS_HOST`            | Base URL of the DotCMS instance. Server-side only.                                                   |
| `DOTCMS_AUTH_TOKEN`      | API token (generate in DotCMS under User Tools > API Tokens). Server-side only.                      |
| `SITE_N`                 | Site definition: `hostname                                                                           |siteIdentifier|assetSlug`. The `siteIdentifier` is the DotCMS site identifier (not the inode). The `assetSlug` maps to the folder under `public/assets/` for static site-specific assets (logos, etc). |
| `DEFAULT_SITE_HOST`      | Hostname to fall back to when the incoming request doesn't match any configured site.                |
| `FRONTEND_HOST_OVERRIDE` | Pins the deployment to one site, regardless of Host header. The standard mechanism for per-site production deployments; also useful in local dev. |

> **Convention:** keep the `SITE_N` list (and `DEFAULT_SITE_HOST`) identical on every deployment — only
> `FRONTEND_HOST_OVERRIDE` varies per deployment. An override host with no matching `SITE_N` entry resolves with an
> undefined `siteId`, and every DotCMS call fails silently.

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
│   ├── layout.tsx                 # Root layout — Header, Footer, UVEBodyClass, CookieBanner
│   ├── not-found.tsx              # 404 page
│   ├── globals.css                # Tailwind config, theme tokens, UVE styles, prose/table overrides
│   ├── [[...slug]]/
│   │   └── page.tsx               # Catch-all — home, URL-mapped detail pages, generic pages
│   ├── issues/[slug]/
│   │   └── page.tsx               # Archived issue home page (past issue via HomePage layout)
│   ├── archives/
│   │   └── page.tsx               # Archives page — lists past issues
│   ├── search/
│   │   └── page.tsx               # Full search results page
│   ├── api/
│   │   └── search/route.ts        # Article search API (title + block content, paginated)
│   └── dA/[...path]/
│       └── route.ts               # Asset proxy — forwards /dA/* to DotCMS
│
├── views/
│   ├── Page.tsx                   # Generic DotCMS page (DotCMSLayoutBody + UVE)
│   └── DetailPage.tsx             # URL-mapped content detail page (Article)
│
├── components/
│   ├── Header.tsx                 # Site header — nav (animated underline), search, mobile menu
│   ├── Footer.tsx                 # Site footer — 4-col grid, block editor content, legal links
│   ├── HomePage.tsx               # Custom home page — hero banner, article cards
│   ├── SearchResults.tsx          # Search results page UI (highlight, filter, pagination)
│   ├── ArchivedIssueSelect.tsx    # Custom dropdown on detail pages → /issues/{slug}
│   ├── IssueAccordion.tsx         # Expandable issue list (archives page)
│   ├── CookieBanner.tsx           # First-visit consent banner (per-site, hidden in UVE)
│   ├── UVEBodyClass.tsx           # Adds .dotcms-uve-active class inside UVE iframe
│   ├── UVESiteDetector.tsx        # Detects UVE site switches and reloads
│   ├── content-types/
│   │   ├── index.ts               # Component registry (contentType → component)
│   │   ├── Article.tsx            # Article detail view
│   │   ├── Banner.tsx             # Banner content type (container-based pages)
│   │   ├── FooterContent.tsx      # Footer block editor content
│   │   └── Issue.tsx              # Issue content type
│   ├── shared/
│   │   └── DefaultHeroBanner.tsx  # Reusable red triangle hero banner (data-full-bleed)
│   └── ui/
│       ├── accordion.tsx          # shadcn accordion
│       └── button.tsx             # shadcn button
│
├── utils/
│   ├── dotCMSClient.ts            # Creates a DotCMS API client for a given siteId
│   ├── getDotCMSPage.ts           # Fetches a page by URL path (React cache'd)
│   ├── getDotCMSContent.ts        # Content API queries (issues, articles, footer, search)
│   ├── queries.ts                 # GraphQL fragments (navigation tree)
│   ├── site-config.ts             # Multi-site resolution → { siteId, hostname, assetSlug }
│   ├── imageLoader.ts             # Custom Next.js image loader for DotCMS assets
│   ├── resolveImage.ts            # Normalizes image field → identifier string
│   ├── extractText.ts             # Plain-text + snippet extraction from block editor JSON
│   └── searchArticles.ts          # Client-side search helper (calls /api/search)
│
├── types/
│   ├── content-types.ts           # TypeScript interfaces for all DotCMS content types
│   └── page.ts                    # Page-level types (PageProps, navigation)
│
├── public/assets/                 # Per-site static assets keyed by assetSlug + global/
├── next.config.ts                 # Dev asset prefix, allowed origins, custom image loader
├── AGENTS.md                      # AI-agent onboarding hub (auto-loaded via CLAUDE.md)
└── docs/
    ├── content-types.md           # DotCMS field type → React rendering reference
    ├── uve-site-detection.md      # Multi-site UVE site-switching
    ├── seo-strategy-plan.md       # Phased SEO implementation plan
    └── seo-strategy-overview.md   # SEO rationale
```

---

## Multi-Site Architecture

All three newsletter sites share one codebase. Site resolution happens per-request in `utils/site-config.ts`,
checked in this order:

1. **`FRONTEND_HOST_OVERRIDE`** env var (dev/deploy override)
2. **Host header** match against configured `SITE_N` hostnames (production DNS routing)
3. **`dotcms_site` query parameter** (set by `UVESiteDetector` during UVE site switches)
4. **`dotcms-uve-site` cookie** (persists UVE site choice across navigations)
5. **`DEFAULT_SITE_HOST`** fallback

`getSiteConfig()` returns `{ siteId, hostname, assetSlug }`. The resolved `siteId` is passed to every DotCMS API call;
`hostname` is used for absolute URLs (canonicals, OG, sitemaps). Each site has its own content, issues, and articles in
DotCMS — the frontend code is shared.

The `assetSlug` determines which folder under `public/assets/` is used for static assets like the header logo (
`/assets/{assetSlug}/header-logo.svg`).

### Deployment models

| Model | How | When |
|---|---|---|
| **Per-site deployments** (production standard) | One deployment per site, each pinned with `FRONTEND_HOST_OVERRIDE` in its environment. Same repo everywhere; different branches can be bound to different site deployments. | Production — one site going down never takes the others with it. |
| **Shared deployment** | One deployment serves every site, resolved per-request from the Host header (or UVE cookie/query param). | Local dev (one local frontend + DotCMS docker serves all sites) and demo environments. |

Both models run the same code with the same env vars — only `FRONTEND_HOST_OVERRIDE` differs per deployment. Keep the
`SITE_N` list identical everywhere.

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

| Path                         | View         | Description                                                                                                                                             |
|------------------------------|--------------|---------------------------------------------------------------------------------------------------------------------------------------------------------|
| `/`                          | `HomePage`   | Custom layout with hero banner, featured articles, and article cards. Data comes from the latest Issue contentlet and its relationships.                |
| `/{issueSlug}/{articleSlug}` | `DetailPage` | URL-mapped content. DotCMS resolves the URL map and returns the matched contentlet in `pageAsset.urlContentMap`. Rendered with the `Article` component. |
| Everything else              | `Page`       | Generic DotCMS page. `DotCMSLayoutBody` reads the page layout and renders each container's contentlets using the component registry.                    |

### Dedicated routes

| Route            | Description                                                                                                                                                                                       |
|------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `/issues/[slug]` | An **archived issue's** home page — same `HomePage` layout as `/`, but rendered from a past issue instead of the latest. Reached via the "View Archived Issues" dropdown on article detail pages. |
| `/archives`      | Lists all past issues with expandable article lists (accordion).                                                                                                                                  |
| `/search`        | Full search results page (`SearchResults`). Reads `?q=`, `?page=`, `?filter=` and queries `/api/search`.                                                                                          |
| `/api/search`    | Server-side article search. Accepts `?q=&siteId=&page=&filter=current\|archived&currentIssueSlug=`, searches **title + block-editor content**, returns paginated results.                         |
| `/dA/[...path]`  | Asset proxy. Forwards `/dA/*` requests to the DotCMS instance with auth, enabling image loading without exposing the DotCMS host to the client.                                                   |

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

The key must exactly match the Content Type Variable name in DotCMS (case-sensitive). `DotCMSLayoutBody` looks up each
contentlet's `contentType` in this map and renders the matching component, passing the full contentlet as props.

### Content model

```
Issue (1)
  ├── banner (1) → Banner
  │     └── article (1) → Article   (hero article)
  └── articles (N) → Article        (all articles in the issue)

Article
  ├── title, slug, teaser, issueSlug
  ├── image, mobileImage, heroImage (binary/file)
  ├── content (Block Editor)
  ├── tags                          (surfaced in the editor as "Keywords")
  ├── featuredArticle (boolean)
  └── metaTitle, metaDescription    (optional SEO overrides — see docs/seo-strategy-plan.md)

FooterContent
  ├── title
  ├── content (Block Editor)
  └── showNewsletterLinks (boolean)
```

Every contentlet also carries `live` and `archived` booleans. TypeScript interfaces for all content types live in
`types/content-types.ts`.

For a full reference on how different DotCMS field types map to React rendering, see `docs/content-types.md`.

---

## Image Handling

Images are handled globally via a custom Next.js image loader configured in `next.config.ts`:

```ts
images: {
    loader: "custom",
        loaderFile
:
    "./utils/imageLoader.ts",
}
```

This means all `<Image>` components automatically use the loader — no need to pass a `loader` prop. The loader:

- Routes through the `/dA/` asset proxy
- Appends DotCMS transformation parameters (`/{width}maxw/{quality}q`)
- Applies adaptive quality based on viewport width (lower quality for smaller screens)
- Passes through external URLs, GIFs, and SVGs unchanged

Usage:

```tsx
<Image src={`/dA/${identifier}`} width={800} height={600} alt="..."/>
```

The `resolveImage()` utility (`utils/resolveImage.ts`) normalizes DotCMS image fields — whether they come back as a
string, or an object with `idPath` or `identifier` — into a consistent identifier string.

---

## Search

Search matches on the article **title (primary) and block-editor content (secondary) simultaneously** — the Lucene query
is `+(title:*q* Article.content:*q*) +live:true`. The block-editor `content` field is marked searchable/indexed in
DotCMS.

**API — `app/api/search/route.ts`** accepts:

| Param              | Purpose                                                           |
|--------------------|-------------------------------------------------------------------|
| `q`                | Search term                                                       |
| `siteId`           | Which site to search                                              |
| `page`             | 1-based page (10 results/page)                                    |
| `filter`           | `current` or `archived` — restrict to / exclude the current issue |
| `currentIssueSlug` | The latest issue's slug, used by the filter                       |

Returns `{ results, total, page, pageSize }`.

**Two entry points:**

1. **Header search box** (`components/Header.tsx`) — debounced, shows a reactive dropdown of matches; pressing **Enter**
   navigates to `/search?q=…`.
2. **Search results page** (`app/search/page.tsx` → `components/SearchResults.tsx`) — full results with the query
   highlighted in both titles and a content snippet (extracted via `utils/extractText.ts`), "Current Issue / Archived
   Issues" filter radios, and pagination. The highlight + result count update on submit (not on keystroke). The page
   should be `noindex, follow` once SEO metadata lands.

---

## Archived Issues

The home page (`/`) always shows the **latest** issue. To view a past issue, article detail pages render a **"View
Archived Issues"** dropdown (`components/ArchivedIssueSelect.tsx`) listing every issue except the current one. Selecting
one navigates to `/issues/{slug}`, which renders the same `HomePage` layout from that archived issue's content.

- The dropdown is a **custom** component (not a native `<select>` or shadcn `select`) — fade-in animation, outside-click
  to close, red chevron.
- `getAllIssues(siteId, currentIssueId)` supplies the list; it's passed `DetailPage` → `Article` →
  `ArchivedIssueSelect`.
- The header logo returns the user to `/` (the current issue) — there's intentionally no "back to current" control on
  the archived view.

---

## Live Editing (UVE)

The DotCMS Universal Visual Editor enables in-context editing. This app supports it on all page types:

### How it works

1. **`useEditableDotCMSPage(pageContent)`** is called in `Page.tsx`, `DetailPage.tsx`, and `HomePage.tsx`. This hook
   completes the postMessage handshake with the UVE iframe, enabling live content updates.

2. **`DotCMSEditableText`** wraps text fields to make them inline-editable in the UVE. Used on the home page (article
   titles, teasers) and article detail page (title).

3. **Block Editor editability** is enabled by adding `data-block-editor-content`, `data-inode`, `data-language`,
   `data-content-type`, and `data-field-name` attributes to the container element. Used in `Article.tsx` and
   `Footer.tsx`.

4. **`UVEBodyClass`** (root layout) adds the `dotcms-uve-active` CSS class to `<body>` when inside the UVE iframe. This
   enables UVE-specific styles globally (block editor borders/hover indicators).

5. **`UVESiteDetector`** listens for `CONTENT_CHANGES` events from the UVE. When an editor switches to a different site
   in the DotCMS backend, this component detects the hostname mismatch and reloads the page with the correct site
   context (via cookie + query parameter).

### UVE-specific CSS (`globals.css`)

```css
/* Blue border on block editor fields inside UVE */
.dotcms-uve-active [data-block-editor-content] {
    ...
}

/* Hover highlight on block editor fields */
.dotcms-uve-active [data-block-editor-content]:hover {
    ...
}
```

No extra DotCMS configuration is needed. Ensure `DOTCMS_HOST` points to the correct instance and the UVE app is
installed.

> **Gotcha:** every renderable page must call `useEditableDotCMSPage(pageContent)`, or the UVE loader hangs. `HomePage`
> originally omitted it and the editor never finished loading on the home page — keep the hook on any new view.

---

## Theming

The brand red is defined once as a CSS variable in `globals.css` and exposed to Tailwind:

```css
:root {
    --citgo-red: #b8292f;
}

@theme inline {
    --color-citgo-red: var(--citgo-red);
}
```

Use the Tailwind utilities `bg-citgo-red`, `text-citgo-red`, `accent-citgo-red`, etc. — **never hardcode the hex.**
Changing the brand color is a one-line edit. (The darker triangle shades in `DefaultHeroBanner` are intentionally
separate.)

### Content links

Content/article links use a second variable, `--citgo-link: #005DAA`, exposed to Tailwind as `citgo-link`. The base
color is **blue (`#005DAA`)**; the underline/hover interaction varies slightly by surface:

- **Search results, archives accordion, article body** (block-editor links via `[data-component="Article"] .prose a` in
  `globals.css`) — blue + underline, turning black (`#000`) on hover.
- **"Also In This Issue" sidebar** — blue with **underline on hover only** (`group-hover:underline`), turning black on
  hover.
- **Header "In This Issue" dropdown** — default text color at rest; on hover the text turns blue and a blue underline
  slides in left→right (the `.issue-link` rule, mirroring the orange `.nav-underline` on the nav buttons). Mobile uses
  the plain default color (no hover).

Component links use `text-citgo-link` (+ `underline` / `group-hover:*` as above); article **body** links are styled in
`globals.css`, scoped to the article so the footer's block content keeps its muted links. The footer's structured links
(newsletters, legal, "Visit Other CITGO Sites") and the red "Read More ›" / "Read Article" CTAs are intentionally
**not** part of this treatment.

---

## Cookie Banner

`components/CookieBanner.tsx` slides up from the bottom on first visit (dark bar, "OK" to dismiss, Privacy Policy link).
Notes:

- Consent is stored in `localStorage` under a **per-site** key: `citgo-cookie-consent-{hostname}` (so each site is
  acknowledged independently).
- It is **suppressed inside the UVE** (`window.parent !== window`) so it doesn't obstruct editing.
- Rendered once in the root layout.

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
import type {MyTypeContentlet} from "@/types/content-types";

export default function MyType({title, body}: MyTypeContentlet) {
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

5. Create the site's own deployment with `FRONTEND_HOST_OVERRIDE=newsite.com` in its environment and point DNS at it
   (per-site model) — or point DNS at the shared deployment. Either way, add the `SITE_4` entry to **every**
   deployment's environment so the lists stay identical.

No code changes required — the multi-site config is entirely driven by environment variables.
