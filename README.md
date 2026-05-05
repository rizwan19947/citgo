# Headless DotCMS — Next.js Frontend

A headless CMS frontend built with **Next.js 16** and the **DotCMS React SDK**. DotCMS acts as the content backend; this app fetches pages, layout, and content via the DotCMS API and renders them as a standard React/Next.js site.

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Prerequisites](#prerequisites)
3. [Environment Variables](#environment-variables)
4. [Getting Started](#getting-started)
5. [Project Structure](#project-structure)
6. [How It Works — Data Flow](#how-it-works--data-flow)
7. [The GraphQL Query Explained](#the-graphql-query-explained)
8. [How the Response Is Rendered](#how-the-response-is-rendered)
9. [Adding a New Content Type](#adding-a-new-content-type)
10. [Image Handling](#image-handling)
11. [Live Editing (UVE)](#live-editing-uve)

---

## Tech Stack

| Package | Version | Purpose |
|---|---|---|
| Next.js | 16.2.4 | App framework (App Router, SSR) |
| React | 19.2.4 | UI library |
| @dotcms/client | 1.4.0 | HTTP client for the DotCMS REST/GraphQL API |
| @dotcms/react | 1.4.0 | React components + hooks for rendering DotCMS pages |
| @dotcms/types | 1.4.0 | Shared TypeScript types for DotCMS data shapes |
| Tailwind CSS | 4 | Utility-first styling |
| TypeScript | 5 | Static typing |
| pnpm | — | Package manager |

---

## Prerequisites

- Node.js 18+
- pnpm (`npm i -g pnpm`)
- A running DotCMS instance (local or cloud) with at least one published page

---

## Environment Variables

Create a `.env.local` file in this directory with the following keys:

```env
# Full URL of your DotCMS instance, e.g. https://demo.dotcms.com
NEXT_PUBLIC_DOTCMS_HOST=

# API token — generate one in DotCMS under User Tools > API Tokens
NEXT_PUBLIC_DOTCMS_AUTH_TOKEN=

# The identifier of the DotCMS site you want to serve content from
NEXT_PUBLIC_DOTCMS_SITE_ID=
```

> All three variables are prefixed with `NEXT_PUBLIC_` so they are available in both server and client components.

---

## Getting Started

```bash
# Install dependencies
pnpm install

# Start the development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). The app will serve whatever page DotCMS has published at the `/` URL.

```bash
# Production build
pnpm build
pnpm start
```

---

## Project Structure

```
frontend/
├── app/
│   ├── layout.tsx              # Root layout — font, global CSS, wraps all pages
│   ├── not-found.tsx           # 404 page shown when DotCMS has no content for a path
│   └── [[...slug]]/
│       └── page.tsx            # Catch-all route — handles every URL in the app
│
├── components/
│   ├── Header.tsx              # Site header — receives nav items from DotCMS
│   ├── Footer.tsx              # Site footer
│   └── content-types/
│       └── index.ts            # Registry that maps DotCMS content-type names → React components
│
├── views/
│   └── Page.tsx                # Client component that renders the full DotCMS page layout
│
├── utils/
│   ├── dotCMSClient.ts         # Singleton DotCMS API client (reads from env vars)
│   ├── getDotCMSPage.ts        # Fetches a page from DotCMS by URL path
│   ├── queries.ts              # Reusable GraphQL query strings (navigation tree)
│   └── imageLoader.ts          # Custom Next.js image loader for DotCMS-hosted images
│
├── types/
│   └── page.ts                 # TypeScript interfaces for DotCMS page content shape
│
├── next.config.ts              # Next.js configuration
├── tailwind.config             # Tailwind CSS configuration (via PostCSS)
└── tsconfig.json               # TypeScript configuration
```

### Folder roles at a glance

| Folder | What lives here |
|---|---|
| `app/` | Next.js App Router — routes, layouts, and the 404 page |
| `components/` | Reusable UI pieces (Header, Footer) and the content-type component registry |
| `views/` | Full-page view components that receive DotCMS page data and orchestrate rendering |
| `utils/` | Pure utilities — API client, data fetching, GraphQL strings, image URL builder |
| `types/` | TypeScript interfaces that describe the shape of DotCMS API responses |

---

## How It Works — Data Flow

```
Browser request (e.g. /about)
        │
        ▼
app/[[...slug]]/page.tsx          (Next.js server component)
        │  resolves "/about"
        │  calls getDotCMSPage("/about", { graphql: navigationQuery })
        ▼
utils/getDotCMSPage.ts            (cached server-side fetch)
        │  calls dotCMSClient.page.get()
        ▼
utils/dotCMSClient.ts             (DotCMS REST/GraphQL API)
        │  returns pageAsset + layout + content (nav tree)
        ▼
app/[[...slug]]/page.tsx
        │  checks layout.header / layout.footer flags
        │  passes navItems to <Header>
        │  passes pageContent to <Page>
        ▼
views/Page.tsx                    (client component)
        │  useEditableDotCMSPage() makes it live-editable in UVE
        │  passes pageAsset to <DotCMSLayoutBody>
        ▼
DotCMSLayoutBody                  (@dotcms/react)
        │  reads layout.body → rows → columns → containers → contentlets
        │  looks up each contentlet's contentType in pageComponents map
        ▼
components/content-types/index.ts
        └── renders the correct React component for each content block
```

---

## The GraphQL Query Explained

When a page is fetched, the following GraphQL query is sent alongside the page request to pull the navigation tree in a single round trip:

```graphql
query ContentAPI {
  page(url: "home") {

    # Template metadata — name, identifier, and which theme to apply
    template {
      name
      identifier
      showOnMenu
      theme
    }

    # Page-level SEO and display fields
    friendlyName
    description
    title
    seoTitle
    seodescription

    # Containers hold the actual content blocks.
    # render: false means we get raw data, not pre-rendered HTML.
    containers(render: false) {
      name
      inode
      identifier
      containerContentlets {
        contentlets {
          identifier
          inode
          title
          contentType      # <-- key field: maps to a component in pageComponents
          dotStyleProperties
          live
          baseType
          identifier
        }
      }
    }

    # Layout controls the page structure and which sections are visible
    layout {
      header          # true → render <Header>
      footer          # true → render <Footer>
      body {
        rows {
          columns {
            leftOffset  # column start position (1-based grid)
            width       # how many grid columns wide (max 12)
            containers {
              identifier  # which container to place here
              uuid        # instance ID (same container can appear multiple times)
            }
          }
        }
      }
    }
  }
}
```

### Example response breakdown

```json
{
  "data": {
    "page": {
      "template": { ... },       // ignored at runtime — SDK handles template internally
      "title": "Home",           // used for <title> tag / SEO
      "containers": [
        {
          "identifier": "SYSTEM_CONTAINER",
          "containerContentlets": [
            {
              "contentlets": [
                {
                  "contentType": "HeroCard",   // → renders <HeroCard> component
                  "title": "dotCms getting started",
                  "live": true
                }
              ]
            },
            {
              "contentlets": [
                {
                  "contentType": "Stats",      // → renders <Stats> component
                  "title": "Statistics",
                  "live": true
                }
              ]
            }
          ]
        }
      ],
      "layout": {
        "header": true,           // → <Header> is rendered
        "footer": true,           // → <Footer> is rendered
        "body": {
          "rows": [
            {
              "columns": [
                {
                  "leftOffset": 1,
                  "width": 12,              // full-width column
                  "containers": [
                    { "identifier": "SYSTEM_CONTAINER", "uuid": "1" }
                    // uuid "1" → first containerContentlets entry → HeroCard
                  ]
                }
              ]
            },
            {
              "columns": [
                {
                  "leftOffset": 1,
                  "width": 12,
                  "containers": [
                    { "identifier": "SYSTEM_CONTAINER", "uuid": "2" }
                    // uuid "2" → second containerContentlets entry → Stats
                  ]
                }
              ]
            }
          ]
        }
      }
    }
  }
}
```

**Key points:**
- The `layout.body` describes the visual grid — rows, columns, and which container UUID sits in each cell.
- The `containers` array holds the actual content. The `uuid` in the layout links a grid cell to a specific slot in `containerContentlets`.
- The `contentType` field on each contentlet (e.g. `"HeroCard"`, `"Stats"`) is the key DotCMS uses to look up which React component to render.

---

## How the Response Is Rendered

Once the data reaches the frontend, the DotCMS React SDK takes over:

### 1. `views/Page.tsx` — makes the page live-editable

```tsx
const { pageAsset } = useEditableDotCMSPage(pageContent);
```

`useEditableDotCMSPage` syncs with the DotCMS Universal Visual Editor (UVE). When an editor is viewing the page inside DotCMS, any changes they make are pushed to this hook in real time — no page reload needed.

### 2. `DotCMSLayoutBody` — walks the layout tree

```tsx
<DotCMSLayoutBody page={pageAsset} components={pageComponents} />
```

This component from `@dotcms/react` reads `pageAsset.layout.body` and iterates through every row → column → container → contentlet. For each contentlet it looks up `contentlet.contentType` in the `components` map and renders the matching React component, passing the full contentlet object as props.

### 3. `components/content-types/index.ts` — the component registry

```ts
export const pageComponents = {
  HeroCard: HeroCard,   // renders when contentType === "HeroCard"
  Stats: Stats,         // renders when contentType === "Stats"
};
```

The key must exactly match the `contentType` string that DotCMS returns. Any contentlet whose type is not in this map will be silently skipped.

### Visual summary

```
layout.body.rows[0].columns[0]        (width: 12, leftOffset: 1)
    └── container uuid "1"
            └── SYSTEM_CONTAINER → containerContentlets[0]
                    └── contentlet { contentType: "HeroCard", ... }
                            └── pageComponents["HeroCard"] → <HeroCard {...contentlet} />

layout.body.rows[1].columns[0]        (width: 12, leftOffset: 1)
    └── container uuid "2"
            └── SYSTEM_CONTAINER → containerContentlets[1]
                    └── contentlet { contentType: "Stats", ... }
                            └── pageComponents["Stats"] → <Stats {...contentlet} />
```

---

## Adding a New Content Type

1. Create the component inside `components/content-types/`, e.g. `Banner.tsx`.
2. The component receives the full DotCMS contentlet object as its props — type it against the fields your content type has in DotCMS.
3. Register it in the map:

```ts
// components/content-types/index.ts
import Banner from "./Banner";

export const pageComponents = {
  Banner: Banner,
};
```

4. The key (`"Banner"`) must exactly match the **Content Type Variable** name in DotCMS.

---

## Image Handling

Any image stored in DotCMS should be rendered using the custom loader:

```tsx
import Image from "next/image";
import ImageLoader from "@/utils/imageLoader";

<Image
  loader={ImageLoader}
  src="your-asset-identifier"
  width={800}
  height={600}
  alt="description"
/>
```

The loader builds a URL like:
```
https://your-dotcms-host.com/dA/{asset-id}/{width}w
```

DotCMS resizes the image server-side to the requested width, so Next.js responsive images work out of the box.

---

## Live Editing (UVE)

The Universal Visual Editor (UVE) is DotCMS's in-context editing interface. When a DotCMS editor opens a page in UVE:

- `useEditableDotCMSPage` establishes a message channel between the DotCMS iframe and this app.
- Any drag-and-drop, content edits, or layout changes in the editor are reflected live in the preview without a full reload.
- In production (outside UVE) this hook is a no-op — it simply returns the static `pageContent` unchanged.

No extra configuration is required on the frontend side. Just ensure your DotCMS instance has the UVE app installed and that `NEXT_PUBLIC_DOTCMS_HOST` points to the correct instance.
