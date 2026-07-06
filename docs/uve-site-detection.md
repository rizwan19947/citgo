# UVE Site Detection

> **Scope:** this mechanism matters in **shared deployments** — one deployment serving many sites (e.g. local dev
> against a DotCMS docker). In the per-site production model, each deployment is pinned with `FRONTEND_HOST_OVERRIDE`
> and each DotCMS site's UVE app points at its own frontend URL, so the detector never fires.
>
> **Misconfiguration warning:** if a site's UVE app points at the *wrong* pinned deployment, the detector fires on
> every load but the override always wins the resolution → **infinite reload loop** inside the editor. The fix is
> correcting that site's UVE app URL, not the frontend.

## The problem

When a single Next.js deployment serves multiple DotCMS sites (shared mode), the correct site is resolved from the request's `Host` header (e.g. `citgonow.com` vs `citgonowlubes.com`).

DotCMS's Universal Visual Editor (UVE) loads the frontend inside an iframe. The iframe URL is always the deployed frontend URL, so the `Host` header never matches a site domain. The server has no way to know which site the content editor is working on.

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

It uses the SDK's `createUVESubscription(UVEEventType.CONTENT_CHANGES, ...)` to subscribe to page data updates from the UVE. The subscription callback receives the full page response, including the site the editor is actually viewing at `pageAsset.site.hostName`.

The subscription setup is deferred by one tick (`setTimeout(fn, 0)`) because `useEditableDotCMSPage` (in the parent `Page` component) calls `initUVE` internally, and React runs child effects before parent effects. The deferral ensures the UVE's internal message dispatcher is ready before the subscription is created.

If the hostname from the subscription differs from the one the server rendered (`serverHostname` prop), the component triggers a site switch:
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
          └─ UVESiteDetector mounts, defers subscription by one tick
              └─ initUVE runs (from useEditableDotCMSPage)
                  └─ Subscription activates, receives CONTENT_CHANGES
                      └─ pageAsset.site.hostName differs from serverHostname
                          └─ switchSite() sets cookie + query param, reloads
                              └─ Server reads query param → renders correct site
                                  └─ Next CONTENT_CHANGES → hostnames match → no action
```

## Important: which field to read

The CONTENT_CHANGES callback provides the full page response. Two site-related fields exist:

| Field | Value | Usable? |
|---|---|---|
| `pageAsset.site.hostName` | The site the editor is viewing | Yes |
| `requestMetadata.variables.siteId` | The site the frontend requested via GraphQL | No (echoes the frontend's own request) |

`requestMetadata.variables.siteId` reflects whatever the frontend sent to DotCMS, which on the first load is the default site, not the editor's intended site. Always use `pageAsset.site.hostName`.

## SDK type caveat

The `DotCMSSite` type in `@dotcms/types` defines the field as `hostname` (lowercase), but the runtime data from DotCMS uses `hostName` (camelCase). The detector checks both fields to handle a potential future SDK fix.

## Adding a new site

1. Add a new `SITE_N` env var in the format `hostname|siteId|assetSlug`
2. No changes needed in UVESiteDetector or the page components
