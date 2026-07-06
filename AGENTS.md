# AGENTS.md — Onboarding for AI agents

> Auto-loaded via `CLAUDE.md` (`@AGENTS.md`). Read this first, then the deep-dive docs it links. It captures the architecture, conventions, and every feature built so far so a fresh session has full context without re-deriving it.

## What this project is

A **multi-site headless CMS frontend**: one Next.js 16 (App Router) codebase serves three CITGO newsletter sites — **citgonow.com**, **citgonowlubes.com**, **citgoretailconnections.com**. DotCMS is the content backend and provides the **Universal Visual Editor (UVE)** for in-context editing. Content is fetched via the DotCMS SDK (`@dotcms/client`, `@dotcms/react`, `@dotcms/uve`, `@dotcms/types`) and rendered with React.

**Deployment model:** production is **one deployment per site**, each pinned via `FRONTEND_HOST_OVERRIDE` in its environment (no single point of failure across sites). The shared-deployment mode (Host-header resolution, one deployment for all sites) remains fully supported and is what local dev/demos use. Same repo for all sites; branches can be bound to different site deployments. Keep code **cloud-agnostic** — Vercel hosts only the dev/demo environments and CITGO may deploy anywhere, so never rely on `VERCEL_*` env vars.

Local dev: `npm run dev`. Production build: `npm run build`.

## Where to find things

| Doc | Covers |
|---|---|
| `README.md` | Full dev guide: tech stack, env vars, project structure, routing, image handling, adding sites/content types |
| `docs/content-types.md` | DotCMS field type → React rendering reference |
| `docs/uve-site-detection.md` | How multi-site UVE site-switching works |
| `docs/seo-strategy-plan.md` | The SEO implementation plan (status + phased steps). **Not yet implemented** — see SEO section below |
| `docs/seo-strategy-overview.md` | High-level SEO rationale |

## Critical conventions (read before editing)

- **Indentation is tabs**, not spaces (match existing files). Match surrounding comment density and naming.
- **Don't pass `loader={...}` to `<Image>`.** The custom DotCMS loader is configured globally in `next.config.ts` (`images.loaderFile`). Just use `<Image src={`/dA/${identifier}`} … />`.
- **Theme red is a CSS variable.** `--citgo-red: #b8292f` in `globals.css`, exposed to Tailwind as `citgo-red`. Use `bg-citgo-red` / `text-citgo-red` / `accent-citgo-red` — never hardcode the hex.
- **Content links use `--citgo-link: #005DAA`** (Tailwind `citgo-link`). Base color blue; the underline/hover interaction varies by surface (underline always vs. on-hover; the header "In This Issue" dropdown uses the animated `.issue-link` slide that mirrors the orange `.nav-underline`). Article body links: `[data-component="Article"] .prose a` in `globals.css`. Footer links and the red "Read More"/"Read Article" CTAs are deliberately excluded. See README → Theming → Content links.
- **Never remove TODO comments** or their associated code unless explicitly asked.
- **Plans are saved as docs, not implemented** until the user gives an explicit go-ahead. For multi-step work (e.g. SEO), proceed one step at a time and stop for confirmation.
- **Keep blast radius small.** The user strongly prefers scoped, surgical changes over broad/global ones (e.g. block-editor fixes are scoped to `.prose`/mobile media queries, not global resets).

## Architecture essentials

### Multi-site resolution — `utils/site-config.ts`
`getSiteConfig(searchParams?)` returns `{ siteId, hostname, assetSlug }`, resolved per-request in this priority:
1. `FRONTEND_HOST_OVERRIDE` env (dev/deploy override)
2. Host header match against `SITE_N` env vars
3. `dotcms_site` query param (set by `UVESiteDetector` on UVE site switch)
4. `dotcms-uve-site` cookie (persists UVE site across navigations)
5. `DEFAULT_SITE_HOST` fallback

`SITE_N` format: `hostname|siteIdentifier|assetSlug` (use the site **identifier**, not the inode). Every DotCMS call takes `siteId`. **Do not casually expand what this file returns** — the user is protective of its blast radius.

Convention: the `SITE_N` list is **identical on every deployment**; only `FRONTEND_HOST_OVERRIDE` varies (it pins each per-site production deployment). An override host missing from `SITE_N` silently resolves `siteId: undefined`.

### Routing — `app/[[...slug]]/page.tsx` (catch-all) + dedicated routes
- `/` → `HomePage` (custom layout from the latest live Issue)
- `/{issueSlug}/{articleSlug}` → `DetailPage` → `Article` (DotCMS URL-map; matched contentlet is in `pageAsset.urlContentMap`)
- any other DotCMS page → `Page` (`DotCMSLayoutBody` + component registry)
- `/issues/[slug]` → `app/issues/[slug]/page.tsx` — an **archived issue's** home page (same `HomePage` layout, but for a past issue)
- `/archives` → lists past issues in an accordion
- `/search` → full search results page (`components/SearchResults.tsx`)
- `/api/search` → server search endpoint (title + block-editor content, paginated, issue filter)
- `/dA/[...path]` → asset proxy to DotCMS (adds auth, hides DotCMS host)

### Content model (relationships fetched via `.depth()`)
```
Issue → banner (1) → Banner → article (1) → Article   (hero)
Issue → articles (N) → Article
```
Article fields: `title, slug, teaser, issueSlug, image, mobileImage, content (Block Editor), tags, featuredArticle, heroImage` + SEO: `metaTitle, metaDescription` (and `tags` is surfaced in the editor as "Keywords"). Every contentlet also carries `live` and `archived` booleans.

> **Draft visibility is NOT implemented yet.** All content fetches use `+live:true`, but DotCMS `.depth()` returns related contentlets **regardless of publish state**, so a draft Article related to a live Issue currently *can* leak onto the frontend. A proper draft/staging strategy is being (re)designed — do not assume any filtering exists.

### UVE (in-context editing)
- `useEditableDotCMSPage(pageContent)` is called in `Page.tsx`, `DetailPage.tsx`, **and** `HomePage.tsx` — it completes the postMessage handshake. **A page that skips this hook hangs the UVE loader** (this was a real bug; HomePage originally lacked it).
- `DotCMSEditableText` makes individual text fields inline-editable (home article titles/teasers, article detail title).
- Block-editor fields are made editable via `data-block-editor-content` / `data-inode` / `data-language` / `data-content-type` / `data-field-name` attrs on the container (see `Article.tsx`, `Footer.tsx`).
- `UVEBodyClass` adds `dotcms-uve-active` to `<body>` inside the iframe (drives UVE-only CSS in `globals.css`).
- `UVESiteDetector` reloads with the right site when an editor switches sites in the backend.
- UVE-only UI (e.g. the cookie banner) is suppressed when `window.parent !== window`.

### Images
Global custom loader (`utils/imageLoader.ts`) via `next.config.ts`. `resolveImage()` normalizes an image field (string identifier, or object with `idPath`/`identifier`) to an identifier. Note: the same field can serialize as a **string** (in relationship arrays) or an **object** (single-contentlet fetch) — always normalize with `resolveImage()`.

### Search
- `/api/search` queries `title` **and** block-editor `content` simultaneously (`+(title:*q* Article.content:*q*)`), supports `page`, and an issue filter (`filter=current|archived` + `currentIssueSlug`). Block-editor content is indexed/searchable in DotCMS.
- The header search box: typing shows a reactive dropdown; **Enter navigates to `/search?q=…`**.
- `components/SearchResults.tsx` renders the results page: highlighted matches (title + a snippet extracted from block content via `utils/extractText.ts`), filter radios, pagination. The highlight/active query only updates on submit, not on keystroke.

### Block-editor rendering quirks (`globals.css`, scoped to `.prose`)
- Empty paragraphs preserved as spacers; table cell borders/zebra striping defined there.
- **Mobile (`max-width: 767px`): block-editor tables become horizontally scrollable** (`display:block; overflow-x:auto`) so wide tables (long emails, many columns) don't blow out the page. A subtle `mask-image` fade (0.5rem, inside the cell padding gutter) hints at horizontal scroll. Desktop tables are untouched. This was hard-won — don't reintroduce global `min-width:0`/`.prose` changes that affect the footer or desktop.

### Other UI
- **Cookie banner** (`components/CookieBanner.tsx`): slides up on first visit, dark bar, "OK" dismisses. `localStorage` key is **per-site** (`citgo-cookie-consent-{hostname}`). Hidden inside the UVE.
- **Archived issues dropdown** (`components/ArchivedIssueSelect.tsx`): custom (not native `<select>`) dropdown on article detail pages; fade-in animation, outside-click close, red chevron; navigates to `/issues/{slug}`. (A shadcn `select.tsx` was tried and removed.)
- **Header nav** has a left-to-right yellow (`#E8A33D`) underline hover animation (`.nav-underline`); the "IN THIS ISSUE" dropdown has separate desktop (`issueOpen`) and mobile (`mobileIssueOpen`) state so they don't interfere.
- Root `<main>` has mobile side padding (`px-6 md:px-0`); full-bleed banners opt out via `data-full-bleed` (negative-margin trick in the layout).

## SEO status (important)
The plan lives in `docs/seo-strategy-plan.md`. **Frontend SEO is not implemented yet.** Done so far: the **search page** (which was the prerequisite) and the **backend Article SEO fields** (`metaTitle`, `metaDescription`, plus `tags` relabeled "Keywords"). Deliberately **dropped** from the original plan: `canonicalUrl`, `searchEngineIndex`, dedicated `ogImage`, `altText`, `metaKeywords` (reasons documented in the plan). Next up is Phase 1 (the `getMetadata.ts` utility + `generateMetadata()` across routes), to be done step-by-step with the user.

## Environment / gotchas
- `next.config.ts`: `assetPrefix` is set **only in dev** (a bare `undefined` in prod broke the Vercel build — keep it conditionally spread).
- Platform is Windows; the shell is PowerShell. Tabs for indentation.
