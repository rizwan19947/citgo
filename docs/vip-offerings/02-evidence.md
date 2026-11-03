# Evidence

Facts the plan relies on, each with its date and source. Reuse them; don't re-measure the
client's instance.

## Measurements

Taken 2026-09-03 against the client's dotCMS (`26.08.19-04`), using a live Article image
(`78884204eaf5b3d0665e71bde2c9ae15`).

### `/dA` image variants

| Request | Content-Type | Bytes |
|---|---|---|
| `/dA/{id}` | image/jpeg | 39,903 |
| `/dA/{id}/800maxw/75q` | image/webp | 28,200 |
| `/dA/{id}/800maxw/webp` | image/webp | 28,200 |
| `/dA/{id}/800maxw/avif` | image/avif | 35,740 |
| `/dA/{id}/800maxw/40q/avif` | **image/webp** | 17,852 |
| `/dA/{id}/800maxw/jpeg` | image/jpeg | 38,534 |
| `/dA/{id}/24w/30q` | image/webp | 494 |

- **WebP quality ladder at 800maxw:** 30q 16,304 · 40q 19,006 · 50q 21,392 · 60q 24,058 ·
  75q 28,200 · 85q 39,904 bytes.
- **Quality vs width:** 100w q25 2,128 (q75 3,674) · 400w q30 14,142 (q75 26,530) · 1920w q75
  135,808 bytes.

What follows:
1. **`{n}q` already returns WebP.** The image loader has served WebP all along, so "add WebP"
   isn't new value.
2. **There's no content negotiation.** dotCMS docs say Safari gets JPEG; it doesn't. WebP came
   back for a Safari User-Agent and for `Accept: image/jpeg`. Negotiation would have to live in the
   frontend (Q4).
3. **AVIF is worse.** 27% larger than WebP. Quality-tuned AVIF is unreachable: `q` is itself a
   format conversion and wins the ordering rule, so `/40q/avif` returns WebP (D10).
4. **LQIP is cheap.** `/24w/30q` is 494 B — about 660 characters of base64.

### Response headers

| Header | Value | Note |
|---|---|---|
| `cache-control` | `no-cache` | Our proxy passes it through (F1) |
| `vary` | absent | Fine while responses don't vary (F7) |
| `x-dotcms-version` | `26.08.19-04` | Core version |
| `x-dotcms-min-sdk` | `0.0.0` | Placeholder. Exists so clients can assert SDK compatibility |
| `x-dotratelimit-toks-max` | `100000/100000` | Token-bucket rate limiter is active |
| `x-dotrequest-cost` | `0.00` | Per-request cost is exposed |
| `x-dot-server` | `dotcms-citgo-dev-{0,1}\|…` | More than one node serves requests |

- Content API responses also report internal timings (`queryTook`, `contentTook`) and
  `resultsSize`.
- The rate limit isn't a pressure point: five `_search` calls cost ~1–2 tokens of a refilling
  100,000 bucket.

## dotCMS platform

- **Hybrid headless.** A page/site-management core (multi-site, containers, templates, URL maps,
  permissions, workflow) with headless delivery added on top. Its page-era assumptions — URL maps,
  container layouts, the `/dA` pipeline — leak into frontend code.
- **Headless surface:**

  | Capability | Vehicle | Maturity |
  |---|---|---|
  | Page delivery | Page API (GraphQL-backed), `client.page.get()` | Solid; drives layout and `urlContentMap` |
  | Content queries | Content API, Lucene or query builder | Solid; `.depth()`, `.draft()`, `.variant()` |
  | Navigation | `client.nav` | Present, unused here |
  | In-context editing | Universal Visual Editor (UVE) + framework SDKs | Newest and most fragile; most likely to break when the SDK changes |
  | Assets and images | `/dA` filter chain | Powerful, poorly surfaced |
  | AI | `client.ai` | Marked `@experimental` |

- **`/dA` filters** (documented): resize `{n}w|h|maxw|maxh|minw|minh`; crop `{n}cw|ch`, focal point
  `{f},{f}fp`; resample `{1-15}ro`; format `/jpeg|/jpegp|/webp|/avif`; quality `{1-100}q`. Format
  conversions must come last.
- **`/dA` addressing.** An asset's *identifier* stays the same across versions; each version gets a
  new *inode*. `/dA/{identifier}` serves the current version, so replacing an image keeps its URL.
  An inode URL pins one version and can return 401 once the asset is updated.
- **`.depth()` returns related content regardless of publish state**, so a draft related to live
  content can leak onto the frontend. Platform-wide and unsolved.

## The SDK

**Release history** of `@dotcms/client` (npm, checked 2026-11-02):
- First published 2024-01-03 as `0.0.1-alpha.0`. 328 versions since; 49 of them after 2026-09-03.
- Versioning changed twice: alpha → semver → CalVer. The last 1.x shipped 2026-07-20; CalVer began
  the next day (`26.7.21-1`). Latest: `26.10.29-1`.
- This project pins **`1.4.0`** (published 2026-04-09) for all four `@dotcms/*` packages — the
  abandoned semver line. CalVer builds matching core exist (`26.8.19-1` to `26.8.19-4`).
- Version strings differ in padding: the SDK writes `26.8.19-4`, core reports `26.08.19-04`.
  Normalise before comparing.
- At this release rate, SDK/core drift is a recurring risk, not a one-off mistake.
  `x-dotcms-min-sdk` exists to catch it; nothing read it before the doctor.

**What 1.4.0 does** (read from the installed source):
- `page.get()` calls `/api/v1/graphql`. Content queries call `/api/content/_search`. Navigation
  calls `/api/v1/nav`.
- Content queries are scoped `+(conhost:{siteId} conhost:SYSTEM_HOST)`. With no siteId they return
  `SYSTEM_HOST` content only — so an unresolved site gives wrong or empty content, not an error.
- The client config accepts `httpClient` (a `DotHttpClient` with `request(url, options)`, which
  must throw `DotHttpError` on failure) and `requestOptions`. Without an `httpClient`, requests use
  the global `fetch`. The default `FetchHttpClient` isn't exported.

## Next.js 16.2.4

Read from the installed source, 2026-11-02.

- **Custom image loaders get the `quality` prop unchanged.** Rounding to `images.qualities` happens
  only in Next's default loader. In dev, Next warns about any `quality` prop not listed in
  `images.qualities` (default `[75]`).
- **`<Image>` is lazy unless `preload` is set.** `preload` replaces `priority` in Next 16; setting
  both throws.
- **Route handlers answer `HEAD` by running `GET`.** A `HEAD` to `/dA/...` downloads the whole
  image from dotCMS.
- **Folders starting with `_` under `app/` are private** and never routed.
- **`loadEnvConfig()` from `@next/env`** loads env files exactly as Next does. It's installed with
  `next`.

## Node runtime

- Running `.mts` files directly (type stripping) is on by default from Node 22.18 and 23.6. The
  repo has no `engines` field; local dev uses Node 24.4.1.
- `process.loadEnvFile()` doesn't override variables that are already set: CI secrets win, and
  `.env.local` (loaded first by the doctor) beats `.env`. It doesn't expand `$VAR` references. The
  doctor loads only `.env.local` and `.env`; Next also reads `.env.production` / `.env.development`.
- Calling `process.exit()` right after writing a lot to stdout cuts the output short when it's
  piped: a 1 MB write arrived as 64–128 KB in every run (macOS, 2026-11-02). Setting
  `process.exitCode` instead avoids it.

## Defects found

F1–F3 and F7 were found by measurement on 2026-09-03; F4–F6 by code audit on 2026-11-02. None of
them shows up in tests, code review or a default Lighthouse run.

**F1 — Every image is served `no-cache`.** `app/dA/[...path]/route.ts` does
`res.headers.get("cache-control") || "public, max-age=31536000, immutable"`. dotCMS sends
`no-cache`, so the fallback never runs and every image is refetched on every navigation — more
origin load, bandwidth and rate-limit use. The highest-value fix in the suite.
*Fix:* Stage 2, policy pending Q3. *Detected by:* `proxy.cacheable`.

**F2 — Image quality is inverted.** `getAdaptiveQuality()` in `utils/imageLoader.ts` maps render
width to quality as `≤375 → q25 · ≤640 → q30 · ≤768 → q37 · ≤1024 → q50 · else q75`. It compresses
hardest where there are fewest bytes to save (numbers in the plan, Stage 2). *Fix:* Stage 2.

**F3 — SDK `1.4.0` (semver) runs against core `26.08.19-04` (CalVer).** Unvalidated until the
doctor. *Not fixed:* upgrading isn't planned (D12); the doctor tracks drift from the handover
baseline (B2).

**F4 — The home hero image loads lazily.** It's the page's largest image (the LCP element), and
`HeroBanner` in `components/HomePage.tsx` renders it without `preload`. Desktop and mobile versions
are two `<Image>`s hidden with CSS. Lazy images hidden with `display:none` likely aren't fetched
today, but making both eager would download both. *Fix:* Stage 2.

**F5 — Fetch failures are silent.** Every fetcher in `utils/getDotCMSPage.ts` and
`utils/getDotCMSContent.ts` catches all errors and returns `undefined`, which becomes `notFound()`
or an empty section. Renders and builds pass with pages missing — the likely cause of the client's
404s. *Detection only:* P3's coverage check (Q6). Changing the error handling is an app change
outside VIP.

**F6 — Layout fetches run in series.** `app/layout.tsx` does
`Promise.all([await getLatestIssue(siteId), await getFooterContent(siteId)])`. The inner `await`s
run the two calls one after the other on every page. *Fix:* a two-line change, not scheduled —
owner's call.

**F7 — Not a defect today: the proxy forwards only `Authorization` and sends no `Vary`.** Both were
listed as live defects in Sept. dotCMS ignores `Accept` and the responses don't vary, so neither has
any effect. They matter only if format negotiation is built (Q4).

## The client's deployment

What's known as of Sept 2026:
- CITGO forked the handover repo and runs it on Windows Server with IIS. Their staging host
  resolves only on internal DNS.
- About 50–60 migrated articles returned IIS's own 404 page there, while the same URLs worked
  locally and on our dev/demo deployments against the same dotCMS. New articles 404'd too, and
  republishing in dotCMS changed nothing.
- Leading hypothesis: their fork renders at build time, and any page whose fetch failed during the
  build got no HTML. F5 lets the build pass anyway.
- Outcome not recorded (Q1).

## Sources

- dotCMS:
  [SDK client library](https://dev.dotcms.com/docs/build/headless-and-sdks/sdk-libraries/sdk-client-library) ·
  [Headless SDK](https://dev.dotcms.com/docs/headless-sdk) ·
  [Image resizing and processing](https://dev.dotcms.com/docs/build/apis/api-basics/image-resizing-and-processing) ·
  [UVE headless config](https://dev.dotcms.com/docs/uve-headless-config) ·
  [Data model — identifiers and inodes](https://dev.dotcms.com/docs/data-model) ·
  [core#22207 — inode `/dA` URLs break when the asset is updated](https://github.com/dotCMS/core/issues/22207)
- npm registry metadata for `@dotcms/client` (2026-09-03 and 2026-11-02).
- Installed source: `node_modules/next` 16.2.4, `node_modules/@dotcms/client` 1.4.0.
- [CrUX methodology](https://developer.chrome.com/docs/crux/methodology) ·
  [CrUX eligibility](https://www.debugbear.com/blog/chrome-user-experience-report) ·
  [OpenTelemetry status](https://opentelemetry.io/status/)
- Direct measurement against the CITGO dev instance (2026-09-03).
