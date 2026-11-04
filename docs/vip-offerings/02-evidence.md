# Evidence

Facts the plan relies on. Reuse them; don't re-measure the client's dotCMS.

## Image measurements

Taken 2026-09-03 on the client's dotCMS (version `26.08.19-04`), using one real article image.

| Request | Format returned | Size |
|---|---|---|
| Original (`/dA/{id}`) | JPEG | 39,903 B |
| 800px wide, quality 75 (`/800maxw/75q`) | WebP | 28,200 B |
| 800px wide, as WebP (`/800maxw/webp`) | WebP | 28,200 B |
| 800px wide, as AVIF (`/800maxw/avif`) | AVIF | 35,740 B |
| 800px wide, quality 40, as AVIF (`/800maxw/40q/avif`) | **WebP** | 17,852 B |
| 800px wide, as JPEG (`/800maxw/jpeg`) | JPEG | 38,534 B |
| 24px wide, quality 30 (`/24w/30q`) | WebP | 494 B |

- **WebP size by quality, at 800px:** q30 16,304 · q40 19,006 · q50 21,392 · q60 24,058 ·
  q75 28,200 · q85 39,904 bytes.
- **Size by width:** 100px at q25 is 2,128 B (3,674 at q75) · 400px at q30 is 14,142 B (26,530 at
  q75) · 1920px at q75 is 135,808 B.

What this tells us:
- Asking for any quality already returns WebP, so the site has always served WebP.
- dotCMS ignores what the browser asks for. It sent WebP to Safari, and to a request for JPEG.
- AVIF is 27% bigger than WebP, and adding a quality setting turns it back into WebP, so AVIF can't
  be tuned (D11).
- A tiny blurred preview would cost only 494 bytes.

## dotCMS response headers

| Header | Value | Meaning |
|---|---|---|
| `cache-control` | `no-cache` | Tells browsers not to cache. Our image proxy passes it on (F1) |
| `vary` | not sent | Fine, since responses don't vary (D11) |
| `x-dotcms-version` | `26.08.19-04` | The dotCMS version |
| `x-dotcms-min-sdk` | `0.0.0` | Meant to state the oldest supported SDK; a placeholder here |
| `x-dotratelimit-toks-max` | `100000/100000` | A rate limit is on |
| `x-dotrequest-cost` | `0.00` | What each request costs against the limit |

The rate limit isn't a concern: five searches used 1–2 of 100,000 tokens, which refill.

## Live runs

### From the doctor's live run (2026-11-04)

- dotCMS now reports version `26.10.13-01`, up from `26.08.19-04` on 2026-09-03 (F3).
- Published articles: citgonow.com 539, citgonowlubes.com 218, citgoretailconnections.com 255.
- dotCMS answered the first request in about 1 second.

### From the watchdog's first run (2026-11-04)

Run against `localhost:3000` for citgoretailconnections.com. No site was running, so no pages
loaded, but the dotCMS side confirmed:
- The Article type's URL map pattern is `/{issueSlug}/{slug}`, read from
  `/api/v1/contenttype/id/Article`. Image fields are recognised by their `clazz`, as the code
  assumes.
- A search sorted `modDate desc` returns the most recently changed items first.
- The image lookup works: the 5 newest articles use 4 images, all published.
- The `/issue/{issueSlug}/article/{slug}` links in `Banner.tsx` and `Issue.tsx` don't match that
  pattern, so they only work if something else maps them, such as a vanity URL. Those components
  render only on generic dotCMS pages (`views/Page.tsx`).

### From the watchdog's second run (2026-11-04)

Run against a local dev server (`npm run dev`) for citgoretailconnections.com, checking `/` and the
5 newest articles: 9 passed, 1 warning (the version), no errors.
- Every page answered 200 through dotCMS's page API. The image proxy returned an image without
  leaking the dotCMS host or token. So the site works on dotCMS `26.10.13-01`, and the baseline
  moved to it (D13).
- The run took 30 seconds. Each article page took about 4 seconds, and the home page 4.3 seconds.
  dotCMS answered the first request in about 1 second and later ones in about half a second.

## How dotCMS works

- **Image filters** run left to right: resize, crop, then format. The format must come last, and a
  quality setting counts as a format, which is why it overrides AVIF.
- **Image addresses.** Each image has a fixed *identifier*, plus a new *inode* for every version.
  `/dA/{identifier}` always serves the latest version, so replacing an image keeps its address. An
  inode address shows one version and can stop working (a 401 error) after an update.
- **Drafts can leak.** When content is loaded together with its related items, unpublished items
  come along too. This affects all of dotCMS.

## The dotCMS SDK

- 328 releases since January 2024 (49 since 2026-09-03), and two changes of numbering scheme. The
  old 1.x line stopped on 2026-07-20; date-based versions (`26.x`) started the next day. Latest:
  `26.10.29-1`.
- This project uses **`1.4.0`** (April 2026) from the abandoned 1.x line, for all four dotCMS
  packages. A version matching the client's dotCMS exists (`26.8.19-4`).
- At this pace, the SDK falling behind dotCMS is a regular risk, not a one-off.

What version 1.4.0 does (from its source code):
- Pages load through dotCMS's page API (`/api/v1/graphql`). Content loads through its search API
  (`/api/content/_search`).
- Searches are limited to the configured site (`+conhost:{siteId}`) and language 1, which is also
  sent in the request body. Content shared by all sites (`SYSTEM_HOST`) is only included if code
  asks for it with `includeSystemHost()`, and this app doesn't. With no site set there's no site
  limit at all, so a misconfigured site shows content from every site instead of an error.

## What a page costs

Every page is built fresh on each request (D6), and each build calls dotCMS. From this repo's code:
- An article page makes 5 calls: the page, the latest issue, the footer, the article's issue, and
  the list of issues. Three are heavy: two load issues three relationship levels deep, and one
  loads up to 100 issues.
- The home page makes 3 calls, `/archives` 3, and `/search` 2.

## Next.js 16.2.4

From its source code (2026-11-02):
- A custom image loader receives the `quality` value unchanged. In development, Next warns about
  quality values not listed in its settings (by default, only 75).
- Images load lazily unless marked `preload` (Next 16's replacement for `priority`).
- **How an image picks its size.** A fixed-width image offers the browser two sizes, 1× and 2× (not
  3×), each rounded up to Next's standard widths (32–384 for small images, then 640, 750, 828,
  1080, 1200, 1920, 2048, 3840). A 400px card offers 640px and 828px. A full-width image offers all
  standard widths, so a phone 390px wide with a 3× screen picks 1200px.
- A `HEAD` request to a route runs the full `GET`, so a `HEAD` to `/dA/...` downloads the whole
  image.
- **A missing page answers 404 only if the response hasn't started.** A page that calls
  `notFound()` before then gets a real 404 (`app-render.js`, checked 2026-11-04). This app has no
  `loading.tsx`, so a missing article always answers 404, which the watchdog relies on. Once a page
  streams (behind `loading.tsx` or `<Suspense>`), status 200 has already gone out, so a missing
  page answers 200.
- Settings files load in this order, first value wins: `.env.{mode}.local`, `.env.local`,
  `.env.{mode}`, `.env`. The mode is `development` in dev and `production` otherwise
  (`.env.local` is skipped in tests). Values already set in the environment win, and `$VAR`
  references are expanded.

## Node.js

- Node runs TypeScript (`.mts`) files directly from version 22.18 (or 23.6). `package.json`
  requires 22.18 or newer since Stage 1b; local development uses 24.4.1.
- Node's own settings loader doesn't overwrite values that are already set, and doesn't expand
  `$VAR`. Since Stage 1b the doctor loads the same files as Next, in the same order (B7), but
  leaves `$VAR` unexpanded.
- Calling `process.exit()` right after printing a lot can cut the output short: 1 MB of output
  arrived as 64–128 KB in every test. Setting `process.exitCode` avoids it.

## Defects found

F1–F3 were measured on 2026-09-03; F4–F6 were found in the code on 2026-11-02. None would show up
in tests, code review or a standard Lighthouse run.

**F1 — The intended image cache never worked.** Our image proxy (`app/dA/[...path]/route.ts`) has
a fallback to a one-year cache, but dotCMS always sends "don't cache", so the fallback never runs
and every image downloads again on every page. Not fixed, on purpose: browser caching stays off for
now, and caching is each client's CDN decision (D11). Stage 3 removes the dead fallback.

**F2 — Image quality is backwards.** `getAdaptiveQuality()` in `utils/imageLoader.ts` picks a
quality from the pixel width the browser asks for: q25 for the smallest, rising to q75 for the
largest. So quality follows screen sharpness rather than the image, compression lands where there
are fewest bytes to save, and small images get hit hardest even though they degrade fastest.
Fix: Stage 3.

**F3 — The SDK is on an old version line.** `1.4.0` (old numbering) ran against dotCMS
`26.08.19-04` (date-based) at handover, and against `26.10.13-01` by 2026-11-04. Not fixed:
upgrading isn't planned (D13). The doctor tracks drift from the baseline versions (B2). It flagged
this upgrade on its first live run; the watchdog then showed the site still works on it, and the
baseline moved to it.

**F4 — The home page's main image loads late.** The hero image in `components/HomePage.tsx` is the
largest thing on the page, but it loads lazily. Its mobile and desktop versions are both on the
page, one hidden with CSS. Today probably only the visible one downloads, but loading both early
would download both. Fix: Stage 3.

**F5 — Loading failures are silent.** Every dotCMS fetch (`utils/getDotCMSPage.ts`,
`utils/getDotCMSContent.ts`) catches errors and returns nothing. The page then shows "not found"
or an empty section, and builds still pass. In September 2026, about 50–60 articles went missing on
CITGO's own copy (Windows/IIS), most likely this way: it builds pages ahead of time, a setup this
suite doesn't target (D6). The watchdog's article check catches it (Stage 2); changing the error
handling is an app decision outside this project.

**F6 — Two layout requests wait for each other.** `app/layout.tsx` puts them in `Promise.all` but
`await`s each one inside it, so they run one after the other on every page. Fix: two lines; not
scheduled — owner's call.

## Sources

- dotCMS:
  [SDK client library](https://dev.dotcms.com/docs/build/headless-and-sdks/sdk-libraries/sdk-client-library) ·
  [Image resizing and processing](https://dev.dotcms.com/docs/build/apis/api-basics/image-resizing-and-processing) ·
  [Data model — identifiers and inodes](https://dev.dotcms.com/docs/data-model) ·
  [core#22207 — inode `/dA` URLs break when the asset is updated](https://github.com/dotCMS/core/issues/22207)
- npm registry data for `@dotcms/client` (2026-09-03 and 2026-11-02).
- Installed source code: `node_modules/next` 16.2.4, `node_modules/@dotcms/client` 1.4.0.
- [CrUX methodology](https://developer.chrome.com/docs/crux/methodology) ·
  [CrUX eligibility](https://www.debugbear.com/blog/chrome-user-experience-report) ·
  [OpenTelemetry status](https://opentelemetry.io/status/)
- Direct measurement on the CITGO dev system (2026-09-03).
