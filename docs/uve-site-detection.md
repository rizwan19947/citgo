# UVE Site Detection

## The problem

This project is a single Next.js deployment that serves multiple DotCMS sites (multisite). In production, the correct site is resolved from the request's `Host` header (e.g. `citgonow.com` vs `citgonowlubes.com`).

DotCMS's Universal Visual Editor (UVE) loads the frontend inside an iframe. The iframe URL is always the single deployed frontend URL, so the `Host` header never matches a site domain. The server has no way to know which site the content editor is working on.

## How it works

Three files collaborate to solve this:

```
app/[[...slug]]/page.tsx        (server)  resolves the site, renders the page
utils/site-config.ts            (server)  site resolution logic with fallback chain
components/UVESiteDetector.tsx  (client)  detects site mismatch inside the UVE iframe
```

### 1. Server-side resolution (`site-config.ts`)

`getSiteConfig()` resolves which site to render using a priority chain:

1. `FRONTEND_HOST_OVERRIDE` env var (dev/deploy override)
2. `Host` header match (production DNS routing)
3. `dotcms_site` query parameter (set by UVESiteDetector on reload)
4. `dotcms-uve-site` cookie (persists across UVE navigations)
5. Hardcoded default

On the first UVE load, none of 1-4 match the editor's site, so the default renders.

### 2. Client-side detection (`UVESiteDetector.tsx`)

This React component renders nothing visually. It only activates when the page is inside an iframe (i.e. the UVE).

It listens for `uve-set-page-data` messages that DotCMS posts to the iframe. These messages contain the page data for the site the editor is actually viewing at `payload.pageAsset.site.hostName`.

If that hostname differs from the one the server rendered (`serverHostname` prop), the component triggers a site switch:
- Sets a `dotcms-uve-site` cookie (for HTTPS environments)
- Adds a `dotcms_site` query parameter to the URL
- Reloads the page

On the next request, `getSiteConfig()` picks up the query param or cookie and renders the correct site.

A `useRef` flag prevents the handler from firing multiple times during the navigation.

### 3. Page wiring (`page.tsx` and `Page.tsx`)

The server component (`page.tsx`) calls `getSiteConfig(searchParams)` to resolve the site, then passes `serverHostname` and `siteIdMap` down through `Page.tsx` to `UVESiteDetector`.

`siteIdMap` is a `Record<siteId, hostname>` built from `SITE_CONFIGS`. Its values are used by UVESiteDetector as the set of known/valid hostnames.

## Data flow

```
Editor switches site in DotCMS
  └─ UVE loads iframe with frontend URL (no site identifier)
      └─ Server renders default site (Host header doesn't match)
          └─ UVESiteDetector mounts, listens for postMessage
              └─ UVE sends uve-set-page-data with pageAsset.site.hostName
                  └─ Hostname differs from serverHostname
                      └─ switchSite() sets cookie + query param, reloads
                          └─ Server reads query param → renders correct site
                              └─ UVE sends same hostName → matches → no action
```

## Important: which field to read from the UVE message

The `uve-set-page-data` message contains two site-related fields:

| Field | Value | Usable? |
|---|---|---|
| `payload.pageAsset.site.hostName` | The site the editor is viewing | Yes |
| `payload.requestMetadata.variables.siteId` | The site the frontend requested via GraphQL | No (echoes the frontend's own request) |

`requestMetadata.variables.siteId` reflects whatever the frontend sent to DotCMS, which on the first load is the default site, not the editor's intended site. Always use `pageAsset.site.hostName`.

## Adding a new site

1. Add an entry to `SITE_CONFIGS` in `utils/site-config.ts` with the hostname as key
2. Add the corresponding `*_IDENTIFIER` env var with the DotCMS site UUID
3. No changes needed in UVESiteDetector or the page components
