# Plan

The build, stage by stage. Reasons are in [Decisions](./01-decisions.md); facts are in
[Evidence](./02-evidence.md).

## Status

| Stage | What | Estimate | Status |
|---|---|---|---|
| 1 | Doctor (P2) | ~2 days | Done 2026-09-11 |
| 1b | Harden the doctor | 1–1.5 days | Next |
| 2 | Watchdog (P3) | ~1 day | Planned |
| 3 | Image fixes (P4) | 0.5–1 day | Planned |
| 4 | Speed checks (P5), then the demo | ~0.5 day | Planned |
| — | dotCMS call tracing (P1) | — | Deferred (D3) |

About 3–4 days remain. There's no fixed deadline.

## Where the code lives

```
vip/
  assertions/          the checks, shared by the doctor and the watchdog
    types.mts          shared types and helpers                          built
    index.mts          the list of checks, and the code that runs them   built
    env.mts            settings checks                                   built
    connectivity.mts   dotCMS connection and version checks              built
    sites.mts          per-site checks                                   built
    proxy.mts          image proxy checks                                built
    content.mts        page, article and image checks                    Stage 2
  lib/siteConfig.mts   reads SITE_N exactly as the app does              built
  runners/cli.mts      the `npm run doctor` command                      built
  runners/report.mts   text and JSON output                              built
  baseline.json        the versions at handover                          Stage 1b
  tests/               tests against a fake local dotCMS                 Stage 1b
  lighthouserc.json    speed budgets                                     Stage 4
```

Rules for code in `vip/`:
- Plain Node, nothing to install (D9).
- No CITGO-specific code: project details come from env settings and from dotCMS (D15).
- Node can't run some TypeScript features (`enum`, `namespace`, constructor shorthand like
  `constructor(private x)`). `tsc` won't catch them; running `npm run doctor` will.
- Relative imports end in `.mts`.
- Checks get their settings passed in and never read `process.env` themselves (D7).

## Stage 1: The doctor (done)

Built 2026-09-11. To run it:

```
npm run doctor                               # check the settings; fails if anything is wrong
npm run doctor -- --json                     # machine-readable output
npm run doctor -- --base-url https://site    # also test the image proxy on a running site
```

What it checks today:

| Check | What it checks |
|---|---|
| `env.required` | The required settings exist: `DOTCMS_HOST`, `DOTCMS_AUTH_TOKEN`, `DEFAULT_SITE_HOST`, at least one `SITE_N` |
| `env.site-format` | Each `SITE_N` has the form `hostname\|siteIdentifier\|assetSlug` |
| `env.site-numbering` | `SITE_N` numbers have no gaps. The app stops at the first gap, so later sites would silently disappear |
| `env.site-identifier-shape` | Site IDs look like identifiers, not inodes *(warning; removed in 1b)* |
| `env.frontend-host-override` | `FRONTEND_HOST_OVERRIDE`, if set, names a configured site. Otherwise the site quietly shows wrong or empty content. The most valuable check |
| `env.default-site-host` | `DEFAULT_SITE_HOST` names a configured site |
| `dotcms.reachable` | dotCMS answers (also reports response time and whether it uses HTTPS) |
| `dotcms.auth` | dotCMS accepts the token |
| `dotcms.version-alignment` | The installed SDK (read from `node_modules`) and the live dotCMS version are on the same version line. It remembers nothing between runs *(warning; replaced in 1b by B2)* |
| `dotcms.rate-limit` | Reports the rate limit; never fails *(removed in 1b)* |
| `sites.resolve` | Each site ID exists and belongs to the site it's listed under |
| `sites.live-issue` | Each site has a published Issue. Without one, its home page falls back to a generic layout *(becomes `sites.live-content` in 1b)* |
| `sites.assets` | Each site's logo exists in `public/assets/` |
| `proxy.round-trip` | The image proxy returns an image |
| `proxy.cacheable` | That image can be cached *(removed in 1b: no browser caching for now, D11)* |
| `proxy.no-leak` | The proxy's response doesn't reveal the dotCMS address or token |

- Site checks cover every site, even when a deployment is pinned to one. Otherwise a broken site
  is only found when someone switches to it.
- The proxy checks need a running site. Without `--base-url` they're skipped, so the doctor can
  pass on settings alone.
- A full run makes 7 requests to dotCMS for three sites, plus 2 with `--base-url`.
- First live run (2026-09-11, with `--base-url`): 14 passed, 1 warning (the SDK version, F3) and
  1 failure (uncached images, F1).

How it's built: plain `node` runs the `.mts` files directly, so there's no build step and nothing to
install. The files are `.mts` because `package.json` doesn't declare ES modules, and
`tsconfig.json` sets `allowImportingTsExtensions` so `.mts` imports pass type-checking.

## Stage 1b: Harden the doctor (next)

**Goal:** fix the doctor's bugs, remove what it doesn't need, make it work for any project, and add
tests.

Bugs found in the 2026-11-02 audit (each reproduced against a fake dotCMS or confirmed in the code):

| ID | Problem | Fix |
|---|---|---|
| B1 | The doctor ignores stray spaces in `SITE_N`; the app doesn't. A space before a `\|` passes the doctor but breaks the site | Read `SITE_N` exactly as the app does, and flag spaces as an error |
| B2 | The version check can't see a dotCMS upgrade: it gives the same warning before and after, and passes any date-based SDK against any dotCMS | Compare against the versions saved in `vip/baseline.json`, and warn on any difference. Read the SDK version from `package-lock.json`, so this works without `npm install` |
| B3 | The doctor's searches differ from the app's: they skip content shared by all sites, and the language filter | Search the way the SDK does (`+(conhost:{siteId} conhost:SYSTEM_HOST)` and `+languageId:1`) in both content searches: the live-content check and the image lookup |
| B4 | If dotCMS returns an image field as an object instead of text, `proxy.round-trip` fails wrongly | Read the field the way `utils/resolveImage.ts` does |
| B5 | Site IDs with dashes are flagged as inodes, but older dotCMS sites do use dashed IDs | Remove `env.site-identifier-shape`. In `sites.resolve`, compare the configured ID with what dotCMS returns, and say so if it's an inode |
| B6 | `process.exit()` can cut off long output | Set `process.exitCode` instead |
| B7 | The doctor reads fewer settings files than Next does (it skips `.env.production` and the like) | Load the same files, in the same order, as [Next does](./02-evidence.md#nextjs-1624). `$VAR` references stay unexpanded |

Also in this stage:
- **Work for any project (D15):** take CITGO's content types out of the checks.
  - `sites.live-issue` becomes `sites.live-content`: each site has published items of the type in
    `DETAIL_CONTENT_TYPE` (CITGO: `Article`). The Issue check goes: CITGO's home page needs a live
    Issue, but that's CITGO's own logic.
  - The proxy check finds its test image on that same type, using the image fields from the type's
    definition in dotCMS (one extra request, only with `--base-url`).
  - The logo check becomes "each site's asset folder exists", so it needs no setting.

  If `DETAIL_CONTENT_TYPE` isn't set, those checks are skipped, with a message saying what to set.
- **Remove what isn't needed:**
  - `VIP_CACHE`, the disk cache in `vip/lib/cachedFetch.mts` (and its `VIP_CACHE_DIR`). Tests
    replace it, the rate limit isn't a concern, and the cache could hide a revoked token or give CI
    stale data.
  - `VIP_BASE_URL`, which repeats `--base-url`.
  - The `dotcms.rate-limit` check: it can't fail, and the limit isn't a concern.
  - The `proxy.cacheable` check: browsers aren't meant to cache images for now (D11).
  - The minimum-SDK comparison: dotCMS sends `0.0.0`, and B2 already catches upgrades (D13). Add it
    back if dotCMS ever sends a real minimum.
- **Node version:** add `"engines": { "node": ">=22.18" }` to `package.json`.
- **Messages:** say what actually happens ("shows wrong or empty content"), not "fails silently".
- **Comments:** fix `types.mts`, which says checks never read files (two do) and mentions "Day 5".
- **Tests:** add `vip/tests/`, using Node's built-in test runner and a fake local dotCMS, with a
  test for each bug. From then on, develop against the fake, not the client's dotCMS.
- **Baseline:** create `vip/baseline.json` from the versions on record: SDK `1.4.0` and dotCMS
  `26.08.19-04` (measured 2026-09-03). No request needed.

Files outside `vip/`: `package.json`.

**Done when:** all seven bugs are fixed with tests; the project-agnostic changes and the removals
are done; the baseline is saved; and one live run of `npm run doctor` passes. That run needs the
owner's OK: it makes 7 read-only requests to the client's dotCMS, without `--base-url`. If it warns
about the version, dotCMS has changed since handover: tell the owner, but it doesn't block the
stage.

## Stage 2: Watchdog (P3)

**Goal:** check a running site by hand: its key pages, its newest detail pages and their images.
Connecting it to CI comes after the MVP is approved (D4).

**2.1 What it checks** (`vip/assertions/content.mts`)
- **Pages:** each page in `WATCHDOG_PAGES` loads with status 200 (default `/`; CITGO:
  `/,/archives,/search`). These are the first checks that load real pages through dotCMS's page
  API (D9).
- **Newest items:** the `WATCHDOG_LATEST` most recently changed items of `DETAIL_CONTENT_TYPE`
  (default 5) each load at their address with status 200 (D16). This catches pages that silently
  404 (F5).
- **Images:** every image those same items use exists in dotCMS, looked up a few hundred IDs at a
  time. Name each missing image. The proxy check already proves images actually download.
- Each run reads the type's definition from dotCMS once: its URL pattern (CITGO:
  `/{issueSlug}/{slug}`) and its image fields. That's one request, however many items there are.
- With the defaults, a run makes about 40 dotCMS requests per site
  ([what a page costs](./02-evidence.md#what-a-page-costs)). Keep them spread out. At high counts
  the results get long, which is why B6 matters.

**2.2 Running it**
- `npm run watchdog -- --base-url https://…` is the same tool in watchdog mode. It checks one
  running site, local or deployed: the one behind that address, matched by hostname, or named with
  `--site`. To skip a site, don't run it for that site (D12).
- Tag each check as settings-only, dotCMS, or running-site (`local`, `upstream`, `deployed`). The
  watchdog skips settings-only checks, which would check this machine's copy of the code, not the
  running site.
- Runs touch the client's dotCMS, so they need the owner's OK.

Files outside `vip/`: `package.json` (the `watchdog` script).

**Done when:** a run against the CITGO site checks its pages, its newest articles and their
images, and the tests show a missing article and a missing image each failing the run by name.

## Stage 3: Image fixes (P4)

**Goal:** sensible image quality, and the home page's main image loading first.

**3.1 Fix image quality (F2)**

Today the loader picks a quality from the pixel width the browser asks for. That goes wrong in
three ways:
- **Quality follows the screen, not the image.** The browser asks for more pixels on sharper
  screens ([how Next picks sizes](./02-evidence.md#nextjs-1624)). A full-width image on a phone
  asks for about 1,200px and gets the top quality (q75), the opposite of the README's "lower quality
  for smaller screens". A featured card gets q30 on a normal screen and q50 on a sharp one.
- **It compresses where there are no bytes to save:**

  | Image width | Quality today | Size | Size at q75 | Saved |
  |---|---|---|---|---|
  | 100px | 25 | 2,128 B | 3,674 B | 1,546 B |
  | 400px | 30 | 14,142 B | 26,530 B | 12,388 B |
  | 1920px (hero) | 75 | 135,808 B | 135,808 B | 0 B |

  Moving the hero to q60 would save roughly 20 KB per page view (estimated from the measured
  quality ratios).
- **Small images handle compression worse.** A thumbnail is a shrunken photo packed with detail.
  At low quality, each compression block covers a big share of it, so it turns blotchy. Big photos
  hide moderate compression well. WebP photos start to look worse at around q40–50.

**Fix:** one quality, between 55 and 65, for every size; resizing already keeps small images small.
Thumbnails cost about 1 KB more each (estimated) and stop looking blotchy. Set the quality in
`utils/imageLoader.ts`, not on each image (Next warns about quality values it doesn't know), and
delete the unused "force high quality" path (`quality={101}`). Add a comment in the loader saying
why images stay WebP (D11), so nobody adds AVIF back.

**3.2 Load the main image first (F4)**
- First, check in DevTools which hero images download today, on mobile and desktop (2 minutes).
- Rebuild the hero with Next's `getImageProps()` and a `<picture>` element (one source for mobile,
  one for desktop), marked `preload` with high fetch priority. Only one image downloads, and it
  downloads first.

**3.3 Remove the dead cache fallback (F1)**
- If dotCMS ever stopped sending "don't cache", the image proxy would fall back to a one-year cache.
  Pass on dotCMS's header as it is, and send `no-cache` when there's none, so the code matches D11
  and caching can't switch on by surprise.

Files: `utils/imageLoader.ts`, `components/HomePage.tsx`, `app/dA/[...path]/route.ts`.

**Done when:** every image uses the single quality, the hero loads first with one image per screen
size, and the proxy has no cache fallback. Before/after numbers are captured.

## Stage 4: Speed checks (P5)

**Goal:** one local command that fails when pages get slower or heavier.

Already in place and unchanged (see `docs/seo-handover.md`): page titles and descriptions, the
`SITE_INDEXING` switch (off, so search engines stay away), canonical and social-sharing tags,
`robots.txt` and self-hosted fonts.

- Run Lighthouse locally, with budgets in `vip/lighthouserc.json`, through an `npm run speed`
  script (`npx @lhci/cli autorun`; it needs Chrome). CI comes after the MVP (D4).
- Fail the run on numbers that don't wobble: total image bytes, request count, and "main image
  loaded lazily".
- Report timings (LCP, CLS, TBT) as warnings only, using the middle result of 3–5 runs. Machines
  vary too much to fail on timings.
- Check the performance score, not the SEO score. The SEO score fails on purpose while the sites
  stay hidden from search engines.
- Then prepare the demo: collect the screenshots taken along the way, and rehearse once.

Files outside `vip/`: `package.json` (the `speed` script).

**Done when:** the speed check fails on a deliberately oversized image, and passes otherwise.

## Demo (30 minutes)

1. **Doctor, broken setup.** Point `FRONTEND_HOST_OVERRIDE` at a site that doesn't exist. The site
   quietly shows the wrong content; `npm run doctor` names the cause.
2. **Doctor, version drift.** The doctor warns that dotCMS changed since handover. (To demo it,
   edit `vip/baseline.json`.)
3. **Watchdog.** A run against the live site checks its pages, newest articles and their images.
   The test data shows a failure that names a missing article.
4. **Image quality.** Bytes per image, before and after.
5. **Main image.** Before: Lighthouse flags the lazy hero. After: one image, loaded first.
6. **Speed checks.** A deliberately oversized image fails the run.

End with: every one of these was invisible in a project that passed review and shipped.

## Later, after the MVP

- **CI/CD integration (D4):** the doctor as a pipeline step, scheduled watchdog runs, speed checks
  in CI. Notes for then: on a private GitHub repo, schedule the watchdog every 2 hours, not every 30
  minutes (a 2-minute job every 30 minutes uses 2,880 of the 2,000 free monthly minutes). Plain cron
  works on any server: `0 */2 * * * cd /app && npm run watchdog -- --json --base-url https://…`.
- **Image caching**, per client, at their CDN (D11). `/dA/{identifier}` keeps its address when an
  image is replaced, so long caching can serve old images
  ([evidence](./02-evidence.md#how-dotcms-works)).
- **SEO extras (D5):** sitemap, structured data, configurable page titles. If built, the sitemap
  must be dynamic (with `FRONTEND_HOST_OVERRIDE` set, Next would otherwise build it once at deploy
  time) and sit behind `SITE_INDEXING`.

## Parked ideas

- **dotCMS call tracing (P1).** Deferred; notes for bringing it back are in D3.
- **Blurred image previews (LQIP).** Cut 2026-11-03. Each preview is small (494 B), but needs its
  own server request and is sent to the browser twice. The benefit is small.
- **Draft-leak check.** dotCMS can return unpublished related content
  ([evidence](./02-evidence.md#how-dotcms-works)); a check could flag unpublished articles inside a
  live Issue.
- **Search check.** Dropped from the watchdog: search routes are project-specific. It could return
  as a config option.
