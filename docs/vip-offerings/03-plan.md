# Plan

How the rest of the suite gets built. Decisions (D, Q) are in [01-decisions](./01-decisions.md);
facts and defects (F) are in [02-evidence](./02-evidence.md). Tasks waiting on an open question are
marked *(pending Qn)*.

## Status

| Stage | Pillar | Estimate | Certainty | Status |
|---|---|---|---|---|
| 1 | P2 — doctor CLI | ~2 d | — | Done 2026-09-11 |
| 1b | P2 — harden the doctor | ~1 d | High | Next |
| 2 | P4 — images and caching | 1.5–2 d (+0.5 d if Q4 builds negotiation) | High — behaviour measured | Planned |
| 3 | P5 — SEO and performance | 0.5–1.5 d, depending on Q2 | High — mostly built | Planned |
| 4 | P3 — watchdog, then demo | 1–1.5 d | Medium | Planned |
| — | P1 — dotCMS call tracing | — | — | Deferred (D3) |

About 4–6 days remain. Order follows D9; no fixed delivery date.

## Code layout

```
vip/
  assertions/            check library — P2 and P3 both use it
    types.mts            Check, CheckResult, CheckContext, result helpers   built
    index.mts            registry, buildContext(), runChecks()              built
    env.mts              env completeness and SITE_N shape                  built
    connectivity.mts     reachability, auth, version alignment, rate limit  built
    sites.mts            per-site resolution matrix                         built
    proxy.mts            /dA round-trip, cacheability, no leaks             built
    content.mts          pages, coverage, assets, search                    Stage 4
  lib/
    siteConfig.mts       SITE_N parser mirroring utils/site-config.ts       built
    cachedFetch.mts      disk cache for local development                   built
  runners/
    cli.mts              npm run doctor                                     built
    report.mts           text and JSON output                               built
  tests/                 node:test + a localhost mock dotCMS                Stage 1b
  baseline.json          core and SDK versions at handover                  Stage 1b
  image/lqip.ts          /24w/30q → data URI                                Stage 2 (optional)
  seo/                   parameterised metadata builders                    Stage 3 (pending Q2)
app/sitemap.ts           per-site sitemap                                   Stage 3 (pending Q2)
.github/workflows/       lighthouse.yml (Stage 3), watchdog.yml (Stage 4) — examples (D4)
```

- `assertions/`, `lib/`, `runners/` and `tests/` run on plain Node: `.mts`, erasable syntax only,
  explicit `.mts` imports ([index, hard constraint 4](./00-index.md#hard-constraints)).
- `image/` and `seo/` are imported by the Next app: plain `.ts`, normal Next rules.
- Checks take everything from `CheckContext` (D7). Code in `lib/` may read the environment.

## Stage 1: Doctor CLI (done)

Built 2026-09-11.

```
npm run doctor                                    # checks .env; exits 1 on any error
npm run doctor -- --json                          # machine-readable output
npm run doctor -- --base-url https://staging.x    # also runs the /dA proxy checks (or set VIP_BASE_URL)
VIP_CACHE=1 npm run doctor                        # replay reads from disk ($VIP_CACHE_DIR, default <tmp>/vip-doctor-cache)
```

| Check | Severity | Asserts |
|---|---|---|
| `env.required` | error | `DOTCMS_HOST`, `DOTCMS_AUTH_TOKEN`, `DEFAULT_SITE_HOST` and at least one `SITE_N` are set |
| `env.site-format` | error | Each `SITE_N` is `hostname\|siteIdentifier\|assetSlug` |
| `env.site-numbering` | error | No gaps. `utils/site-config.ts` stops at the first missing index, so `SITE_1, SITE_3` silently drops `SITE_3` |
| `env.site-identifier-shape` | warn | Values look like site identifiers, not inodes |
| `env.frontend-host-override` | error | `FRONTEND_HOST_OVERRIDE`, if set, matches a `SITE_N` hostname. If not, `siteId` is `undefined` and the site silently serves wrong or empty content. The most valuable single check |
| `env.default-site-host` | error | `DEFAULT_SITE_HOST` matches a `SITE_N` hostname |
| `dotcms.reachable` | error | The host answers; records latency and TLS |
| `dotcms.auth` | error | The token isn't rejected (401/403) |
| `dotcms.version-alignment` | warn | Installed `@dotcms/client` vs `x-dotcms-version` and `x-dotcms-min-sdk` |
| `dotcms.rate-limit` | info | Reports the rate-limit budget |
| `sites.resolve` | error | Every `SITE_N` identifier resolves, to the hostname it claims |
| `sites.live-issue` | error | Every site has a live Issue; without one the home page falls back to the generic renderer |
| `sites.assets` | error | `public/assets/{assetSlug}/header-logo.svg` exists for every site |
| `proxy.round-trip` | error | `/dA/{realAssetId}/200maxw/75q` through the frontend returns an image |
| `proxy.cacheable` | error | That response is cacheable (catches F1) |
| `proxy.no-leak` | error | Its headers contain neither the dotCMS host nor the token |

- Site checks run for **every** `SITE_N`, even when `FRONTEND_HOST_OVERRIDE` pins one. A site that
  only breaks when someone flips the override is a site nobody notices is broken.
- Proxy checks need a running frontend. Without a base URL they skip, so the doctor is green
  against `.env` alone.
- Cost per run: 1 request plus 2 per site (7 for three sites); 2 more with a base URL. Checks share
  one memoised probe per `CheckContext` and run in sequence; site probes run two at a time.
- Result against the live instance (2026-09-11, with a base URL): 14 passed, 1 warning (the real
  SDK/core drift, F3), 1 error (`proxy.cacheable` catching F1, which Stage 2 fixes).

Built differently from the original plan — each change removed scope:

| Planned | Built | Why |
|---|---|---|
| `tsx vip/runners/cli.ts` | `node vip/runners/cli.mts` | Node strips types itself and `process.loadEnvFile()` reads `.env`: no `tsx`, no `dotenv`, zero new dependencies |
| `.ts` files | `.mts` files | `package.json` has no `"type": "module"`, so `.ts` would load as CommonJS. `.mts` forces ESM |
| — | `allowImportingTsExtensions` in `tsconfig.json` | Node needs explicit `.mts` imports and TypeScript needs this flag to allow them. Safe because `noEmit` is set |

## Stage 1b: Harden the doctor (next)

A 2026-11-02 audit found these bugs. B1–B3 and B5–B7 were reproduced against a localhost mock
(no calls to the client's instance); B8–B9 by testing the Node behaviour directly; B4 from the
SDK and doctor source.

| ID | Bug | Evidence | Fix |
|---|---|---|---|
| B1 | The doctor trims `SITE_N` values; the app doesn't | `SITE_1=citgonow.com \|id\|slug` passes the doctor, while the app resolves `siteId: undefined` | Parse exactly as `utils/site-config.ts` does; flag whitespace as an error |
| B2 | The version check can't detect core drift | SDK `1.4.0` against core `26.08.19-04` and against `27.03.02-01` gives the same warning; once the SDK is on CalVer, any core passes | Compare against `vip/baseline.json` (core and SDK at handover). Any difference warns until the baseline is updated. Implements D12 |
| B3 | The minimum-SDK check compares strings | `26.9.2` against minimum `26.10.0` passes; `26.10.0` against `26.9.0` fails. Dormant while the minimum is `0.0.0` | Compare numerically after normalising padding (`26.08.19-04` ↔ `26.8.19-4`); below the minimum is an error |
| B4 | The Page API is never exercised, and hand-written queries differ from the SDK's | The doctor calls `/api/v1/appconfiguration` and `/api/v1/site/{id}`, which the app never uses. The app's `page.get()` goes through `/api/v1/graphql`. The doctor's queries lack the SDK's `SYSTEM_HOST` scoping and language filter | *(pending Q5)* Call `@dotcms/client` the way the app does: per site, `page.get("/")` and the latest-Issue query at `.depth(3)`. Assert the shapes the app relies on — site identity, banner, articles, image fields. Route the SDK's requests through the doctor's fetch with its `httpClient` option. This is the real SDK↔core compatibility test |
| B5 | `VIP_CACHE` hides a revoked token | With the cache primed by a good token, a bad token still passes | Include a hash of the token in the cache key |
| B6 | An object-shaped image field breaks `proxy.round-trip` | It errors with "could not find a live Article image" | Normalise the field the way `utils/resolveImage.ts` does |
| B7 | Dashed identifiers are flagged as inodes | Older or migrated dotCMS sites have dashed identifiers | Decide from the `identifier` and `inode` the site lookup returns, not from the value's shape |
| B8 | `process.exit()` truncates piped output | [Node runtime](./02-evidence.md#node-runtime) | Set `process.exitCode` instead |
| B9 | Env loading differs from Next's | No `$VAR` expansion; `.env.production` is ignored | Load with `loadEnvConfig()` from `@next/env` |

Also in this stage:
- **Node version:** add `"engines": { "node": ">=22.18" }` and an `.nvmrc`. On older Node the
  doctor crashes before any check runs.
- **Messages:** say what actually happens ("serves wrong or empty content"), not "fails silently".
- **Check scopes:** tag each check `local` (env and files), `upstream` (dotCMS) or `deployed`
  (needs a base URL), so the CLI can choose checks by mode. `dotcms.version-alignment` and
  `sites.assets` read files; run remotely, they'd check the runner's checkout, not the deployment.
  Fix the comment in `types.mts` that says checks never touch the filesystem, and its stale
  "from Day 5" reference.
- **Portability:** check a site's aliases before failing `sites.resolve` on a hostname mismatch.
- **Tests:** there are none. Add `vip/tests/` with `node:test` and a localhost mock dotCMS, with
  B1–B9 as cases.
- **Re-baseline** *(needs owner approval — it touches the client's instance)*: one
  `VIP_CACHE=1 npm run doctor` run (7 read-only requests) to record the current core version in
  `vip/baseline.json`. Core may have changed since 2026-09-03.

Touches outside `vip/`: `package.json`, a new `.nvmrc`.

**Done when:** B1–B9 are fixed, each with a test; the baseline is committed; and the doctor is
green against the live instance. With a base URL, `proxy.cacheable` stays red until Stage 2.

## Stage 2: P4 images and caching

### 2.1 Fix `/dA` caching (F1) — first, ~2 h

- In `app/dA/[...path]/route.ts`, set our own `Cache-Control` rather than passing dotCMS's through.
  Policy *(pending Q3)* — recommended: `public, max-age=86400, stale-while-revalidate=604800`. Never
  `immutable` on identifier URLs: replacing an image keeps its URL.
- If dotCMS sends `ETag` or `Last-Modified` on `/dA` (not in the recorded headers), pass them
  through so revalidation can return 304. Check during the before/after measurement.
- Measure and screenshot before and after: DevTools, repeat navigation. This is the demo's headline
  number.
- Quote it with its caveat. The header is correct on any host, but whether it produces cache *hits*
  depends on what sits in front: some CDNs also want `s-maxage` or `CDN-Cache-Control`, and with no
  CDN you get browser caching only. Don't present the number as universal.
- Then tighten `proxy.cacheable` to assert the chosen policy, and extend `proxy.no-leak` to fail on
  any forwarded `x-dot*` header (`x-dotcms-version`, `x-dot-server`) — the likely leak if someone
  later forwards upstream headers.

### 2.2 Format negotiation *(pending Q4 — recommended: don't build)*

If built: forward `Accept`, pick WebP or an explicit `/jpeg` in the frontend, add `Vary: Accept`,
and optionally honour `Save-Data`. Either way, no AVIF (D10). Leave a code comment pointing at the
measurements so nobody adds it back.

### 2.3 Image quality (F2)

Render width is the right input: it already includes device pixel ratio. The mapping is what's
wrong. It saves bytes where there are few to save:

| Render width | Applied q | Bytes | Bytes at q75 | Saved |
|---|---|---|---|---|
| 100w | 25 | 2,128 | 3,674 | 1,546 B |
| 400w | 30 | 14,142 | 26,530 | 12,388 B |
| 1920w | 75 | 135,808 | 135,808 | 0 B |

- Dropping the hero from q75 to q50 saves more than every thumbnail on the page combined.
- q25 is too low at any size. Compression artifacts are per pixel, so they're as visible in a
  100px thumbnail as in a hero. For photographic WebP, visible degradation starts around q40–50.
- Because width includes pixel ratio, a 100px thumbnail on a 3× phone requests 300w and still gets
  q25.
- **Fix:** one quality, 55–65, at every width; let resizing do the byte-saving. Set it in the
  loader rather than through `quality` props, since Next warns in dev about props not listed in
  `images.qualities`. Every `<Image>` passes `75` or nothing today; the loader's `quality={101}`
  "force high quality" path is unused.

### 2.4 Hero loading and art direction (F4)

- First, in DevTools (2 min): which hero images download today, on mobile and on desktop.
- Render the hero with `getImageProps()` and one `<picture>` — a `<source media>` for mobile — with
  `preload` and `fetchPriority="high"`. One image per breakpoint, fetched eagerly.
- Use the same `<picture>` pattern in `components/content-types/Banner.tsx`.
- Note: `components/content-types/Article.tsx` resolves `mobileImage` but never renders it.

### 2.5 LQIP placeholders (optional)

- Source: `/dA/{id}/24w/30q` (494 B, ~660 characters of base64), fetched on the server and passed
  as `placeholder="blur"` with `blurDataURL`.
- Hero and card grid only. Not the 100px sidebar or search-dropdown thumbnails: at today's quality
  they're ~2.1 KB each, so a placeholder would be ~31% of the image, to smooth a flash that barely
  happens.
- Cost: pages render per request (D6), so placeholders ride uncached on every HTML response.
  `HomePage` is a client component, so each one is sent twice — in the HTML and in the RSC payload.
- Never block a render on it. Use a placeholder only if it's already in the per-process cache; on a
  miss, render without it and fill the cache in the background.
- Off by default (D5).

Touches: `app/dA/[...path]/route.ts`, `utils/imageLoader.ts`, `components/HomePage.tsx`,
`components/content-types/Banner.tsx`; for LQIP, also the pages that render `HomePage`.

**Done when:** a repeat navigation serves images from cache, with before/after captured; the hero
loads eagerly with one image per breakpoint; every image uses the flat quality; LQIP renders, if
built.

## Stage 3: P5 SEO and performance

Already built (see `docs/seo-handover.md`): metadata builders with fallbacks
(`utils/getMetadata.ts`), the fail-closed `SITE_INDEXING` gate, per-site canonicals and
OpenGraph/Twitter tags, `app/robots.ts`, self-hosted fonts (`next/font/local`) and per-request
dedup with React `cache()`. The sites are deliberately `noindex`.

### 3.1 Lighthouse CI

- Example workflow `.github/workflows/lighthouse.yml` (a reference, per D4).
- **Fail the build on stable measures:** total image bytes, request count, and the "LCP image was
  lazily loaded" audit.
- **Report timing metrics (LCP, CLS, TBT) as warnings,** taking the median of 3–5 runs. CI runners
  are too noisy to gate on them.
- Assert on the performance category, not SEO: the "blocked from indexing" audit fails by design.
- Optional: a one-page scorecard of the results for non-engineers (lab data).

### 3.2 Only if Q2 says so

- **Parameterise metadata.** Replace the hardcoded `"CITGO"` site name and the
  `https://${hostname}` pattern with config, keeping call sites working. Move the builders into
  `vip/seo/` only once a second project needs them.
- **Sitemap.** `app/sitemap.ts` lists live issues and articles for the resolved site, behind
  `SITE_INDEXING`, failing closed. Mark it dynamic: with `FRONTEND_HOST_OVERRIDE` set,
  `getSiteConfig()` never calls `headers()`, so Next would otherwise build it once at build time —
  and D6 rules out revalidation. Add the `Sitemap:` line to `app/robots.ts` only when indexing is
  on.
- **JSON-LD.** `Article` and `BreadcrumbList` structured data on article pages, behind the same
  gate.

Touches: `.github/workflows/lighthouse.yml` (new); if 3.2 is built, also `utils/getMetadata.ts`,
`app/sitemap.ts` (new), `app/robots.ts` and the article page.

**Done when:** Lighthouse CI fails on a deliberately regressed image budget. If 3.2 is built, the
sitemap and JSON-LD appear and disappear with `SITE_INDEXING`.

## Stage 4: P3 watchdog

The same CLI, pointed at a deployed site (D7). It's the lightest stage, because the checks already
exist.

### 4.1 Content checks — `vip/assertions/content.mts`

- Home, one article, `/archives` and `/search` return 200 with expected markers.
- **Coverage** *(pending Q6)*: every live Article on each site returns 200 at
  `/{issueSlug}/{articleSlug}`. This catches the client's 404s (F5), whatever the rendering mode.
- **Assets:** collect image identifiers from live content and send a `HEAD` for each to dotCMS
  directly, not through the proxy — a `HEAD` through the route runs `GET` and downloads the image.
  Report every 404 by identifier.
- **Search:** `/api/search?q={knownTerm}&siteId={id}` returns `total > 0`.
- Cap concurrency and respect the rate limiter. Per-asset results produce large JSON, which is why
  B8 matters.
- Honour `VIP_SITES` and `VIP_SITES_EXCLUDE` (D11): an excluded site is never probed. Report per
  site.

### 4.2 Schedulers — examples, not the product

- **Plain cron**, which also covers GitLab CI, Jenkins, Azure DevOps or a bare VM:
  `0 */2 * * * cd /app && npm run doctor -- --json --base-url https://…`
- **GitHub Actions** (`.github/workflows/watchdog.yml`): fail the run and open or update an issue on
  a regression. Run every 2 hours, not every 30 minutes. A 2-minute job every 30 minutes uses 2,880
  minutes a month, over the 2,000 a private repo gets. That limit is GitHub's; self-hosted runners
  and cron have none.
- For CITGO, the runner has to sit inside their network (Q7).

### 4.3 Demo assembly

The screenshots captured along the way, and one full rehearsal.

Touches: `.github/workflows/watchdog.yml` (new).

**Done when:** the scheduled run is green, and breaking an asset reference turns it red, naming the
identifier.

## Demo script (30 min)

1. **Break the wiring (P2).** Point `FRONTEND_HOST_OVERRIDE` at an unconfigured host. The site
   silently serves wrong or empty content; `npm run doctor` names the cause.
2. **Version drift (P2).** The doctor flags core moving off the handover baseline. To demo it,
   edit `vip/baseline.json`.
3. **Caching (P4).** DevTools before and after on a repeat navigation; quote the measured
   difference with its CDN caveat.
4. **Hero (P4).** Lighthouse's lazy-loaded-LCP audit before; one eager image per breakpoint after.
   LQIP on Slow 3G, if built.
5. **SEO (P5, if built).** Toggle `SITE_INDEXING`; the sitemap and JSON-LD appear and disappear.
6. **Watchdog (P3).** A red run naming a broken asset identifier — and, with Q6, a missing article.

Close on the [business case](./04-business-case.md#pitch-framing) point: each of these was invisible
in a project that passed review and shipped.

## Parked ideas (not scheduled)

- **P1, dotCMS call tracing.** Deferred. What's already known for reviving it is in D3.
- **Draft-leak detection.** `.depth()` returns unpublished related content
  ([dotCMS platform](./02-evidence.md#dotcms-platform)); a check could flag non-live Articles in a
  live Issue's relationships.
- **Preview error rate as a release-gating SLO.** A recurring enterprise ask; out with the rest of
  observability (D3).
