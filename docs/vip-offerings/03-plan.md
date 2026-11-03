# Plan

The build, stage by stage. Reasons are in [Decisions](./01-decisions.md); facts are in
[Evidence](./02-evidence.md). Tasks marked *(Qn)* wait on an open question.

## Status

| Stage | What | Estimate | Status |
|---|---|---|---|
| 1 | Doctor (P2) | ~2 days | Done 2026-09-11 |
| 1b | Harden the doctor | ~1 day | Next |
| 2 | Image fixes (P4) | ~1 day | Planned |
| 3 | SEO and speed (P5) | 0.5–1.5 days, depending on Q2 | Planned |
| 4 | Watchdog (P3), then the demo | 1–1.5 days | Planned |
| — | dotCMS call tracing (P1) | — | Deferred (D3) |

About 3.5–5 days remain. There's no fixed deadline.

## Where the code lives

```
vip/
  assertions/          the checks, shared by the doctor and the watchdog
    types.mts          shared types and helpers                 built
    index.mts          the list of checks, and the code that runs them   built
    env.mts            settings checks                          built
    connectivity.mts   dotCMS connection and version checks     built
    sites.mts          per-site checks                          built
    proxy.mts          image proxy checks                       built
    content.mts        page, article, image and search checks   Stage 4
  lib/siteConfig.mts   reads SITE_N exactly as the app does     built
  runners/cli.mts      the `npm run doctor` command             built
  runners/report.mts   text and JSON output                     built
  tests/               tests against a fake local dotCMS        Stage 1b
  baseline.json        the versions at handover                 Stage 1b
app/sitemap.ts         sitemap                                  Stage 3 (Q2)
.github/workflows/     example CI files                         Stages 3 and 4
```

Rules for code in `vip/`:
- Plain Node, nothing to install (D9).
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
| `sites.live-issue` | Each site has a published Issue. Without one, its home page falls back to a generic layout |
| `sites.assets` | Each site's logo exists in `public/assets/` |
| `proxy.round-trip` | The image proxy returns an image |
| `proxy.cacheable` | That image can be cached (catches F1) |
| `proxy.no-leak` | The proxy's response doesn't reveal the dotCMS address or token |

- Site checks cover every site, even when a deployment is pinned to one. Otherwise a broken site
  is only found when someone switches to it.
- The proxy checks need a running site. Without `--base-url` they're skipped, so the doctor can
  pass on settings alone.
- A full run makes 7 requests to dotCMS for three sites, plus 2 with `--base-url`.
- First live run (2026-09-11, with `--base-url`): 14 passed, 1 warning (the SDK version, F3) and
  1 failure (uncached images, F1, fixed in Stage 2).

How it's built: plain `node` runs the `.mts` files directly, so there's no build step and nothing to
install. The files are `.mts` because `package.json` doesn't declare ES modules, and
`tsconfig.json` sets `allowImportingTsExtensions` so `.mts` imports pass type-checking.

## Stage 1b: Harden the doctor (next)

**Goal:** fix the doctor's bugs, remove what it doesn't need, and add tests.

Bugs found in the 2026-11-02 audit (each reproduced against a fake dotCMS or confirmed in the code):

| ID | Problem | Fix |
|---|---|---|
| B1 | The doctor ignores stray spaces in `SITE_N`; the app doesn't. A space before a `\|` passes the doctor but breaks the site | Read `SITE_N` exactly as the app does, and flag spaces as an error |
| B2 | The version check can't see a dotCMS upgrade: it gives the same warning before and after, and passes any date-based SDK against any dotCMS | Compare against the versions saved in `vip/baseline.json`, and warn on any difference. Read the SDK version from `package-lock.json`, so this works without `npm install` |
| B3 | The doctor's searches differ from the app's: they skip content shared by all sites, and the language filter | Search the way the SDK does (`+(conhost:{siteId} conhost:SYSTEM_HOST)` and `+languageId:1`), in both `sites.live-issue` and the image lookup behind `proxy.round-trip` |
| B4 | If dotCMS returns an image field as an object instead of text, `proxy.round-trip` fails wrongly | Read the field the way `utils/resolveImage.ts` does |
| B5 | Site IDs with dashes are flagged as inodes, but older dotCMS sites do use dashed IDs | Remove `env.site-identifier-shape`. In `sites.resolve`, compare the configured ID with what dotCMS returns, and say so if it's an inode |
| B6 | `process.exit()` can cut off long output | Set `process.exitCode` instead |
| B7 | The doctor reads fewer settings files than Next does (it skips `.env.production` and the like) | Load the same files, in the same order, as [Next does](./02-evidence.md#nextjs-1624). `$VAR` references stay unexpanded |

Also in this stage:
- **Remove what isn't needed:**
  - `VIP_CACHE`, the disk cache in `vip/lib/cachedFetch.mts` (and its `VIP_CACHE_DIR`). Tests
    replace it, the rate limit isn't a concern, and the cache could hide a revoked token or give CI
    stale data.
  - `VIP_BASE_URL`, which repeats `--base-url`.
  - The `dotcms.rate-limit` check: it can't fail, and the limit isn't a concern.
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

**Done when:** all seven bugs are fixed with tests, the removals are done, the baseline is saved,
and one live run of `npm run doctor` passes. That run needs the owner's OK: it makes 7 read-only
requests to the client's dotCMS, without `--base-url`. If it warns about the version, dotCMS has
changed since handover: tell the owner, but it doesn't block the stage. With `--base-url`, the
image-cache check keeps failing until Stage 2.

## Stage 2: Image fixes (P4)

**Goal:** images get cached, image quality makes sense, and the home page's main image loads first.

**2.1 Cache images (F1)** — first, about 2 hours
- In `app/dA/[...path]/route.ts`, set our own cache rule instead of passing on dotCMS's "don't
  cache". The rule *(Q3)* — recommended: `public, max-age=86400, stale-while-revalidate=604800`.
  Never cache these addresses forever: replacing an image keeps its address.
- Measure and screenshot before and after (DevTools, visiting a page twice). It's the demo's
  headline number.
- Quote it carefully. The rule works on any host, but the actual saving depends on what sits in
  front: some CDNs need extra settings, and without a CDN only browsers cache. Don't present it as
  a universal number.
- Update the doctor's `proxy.cacheable` check to expect the new rule.

**2.2 Fix image quality (F2)**
- The loader's input, the image width, is right. How it picks a quality is backwards: small images
  get the lowest quality, and large ones the highest.

  | Image width | Quality used | Size | Size at q75 | Saved |
  |---|---|---|---|---|
  | 100px | 25 | 2,128 B | 3,674 B | 1,546 B |
  | 400px | 30 | 14,142 B | 26,530 B | 12,388 B |
  | 1920px | 75 | 135,808 B | 135,808 B | 0 B |

  Lowering only the hero image to q50 would save more than all the thumbnails combined.
- q25 looks bad at any size: compression artifacts are just as visible on a small image. WebP
  photos start to look worse at around q40–50. And phones with sharp screens request bigger images,
  which can still fall in the q25 bracket.
- **Fix:** one quality, between 55 and 65, for every size; let resizing save the bytes. Set it in
  `utils/imageLoader.ts`, not on each image (Next warns about quality values it doesn't know).
  Delete the unused "force high quality" path (`quality={101}`).
- Add a comment in the loader saying why images stay WebP (D11), so nobody adds AVIF back.

**2.3 Load the main image first (F4)**
- First, check in DevTools which hero images download today, on mobile and desktop (2 minutes).
- Rebuild the hero with Next's `getImageProps()` and a `<picture>` element (one source for mobile,
  one for desktop), marked `preload` with high fetch priority. Only one image downloads, and it
  downloads first.

Files: `app/dA/[...path]/route.ts`, `utils/imageLoader.ts`, `components/HomePage.tsx`.

**Done when:** a second visit loads images from cache (before/after captured), the hero loads first
with one image per screen size, and every image uses the single quality.

## Stage 3: SEO and speed (P5)

**Goal:** CI fails when pages get slower or heavier.

Already in place (see `docs/seo-handover.md`): page titles and descriptions with fallbacks, the
`SITE_INDEXING` switch (off, so search engines stay away), per-site canonical and social-sharing
tags, `robots.txt`, self-hosted fonts, and de-duplicated dotCMS requests.

**3.1 Lighthouse in CI**
- Add an example workflow, `.github/workflows/lighthouse.yml` (D4).
- Fail the build on numbers that don't wobble: total image bytes, request count, and "main image
  loaded lazily".
- Report timings (LCP, CLS, TBT) as warnings only, using the middle result of 3–5 runs. CI
  machines vary too much to fail a build on timings.
- Check the performance score, not the SEO score. The SEO score fails on purpose while the sites
  stay hidden from search engines.

**3.2 Only if Q2 says so**
- **Configurable page titles:** replace the hardcoded "CITGO" name and `https://${hostname}` with
  settings.
- **Sitemap:** `app/sitemap.ts` lists the live issues and articles, only when `SITE_INDEXING` is
  on. Make it dynamic. Otherwise Next builds it once at deploy time (with `FRONTEND_HOST_OVERRIDE`
  set, the site lookup never reads the request), and D6 rules out periodic rebuilds. Add the
  sitemap line to `robots.txt` only when indexing is on.
- **Structured data:** `Article` and `BreadcrumbList` JSON-LD on article pages, behind the same
  switch.

Files: `.github/workflows/lighthouse.yml`; with 3.2, also `utils/getMetadata.ts`, `app/sitemap.ts`,
`app/robots.ts` and the article page.

**Done when:** Lighthouse CI fails on a deliberately oversized image. With 3.2, the sitemap and
structured data appear and disappear with `SITE_INDEXING`.

## Stage 4: Watchdog (P3)

**Goal:** check the live site on a schedule. The checks mostly exist; this stage adds content
checks and scheduling.

**4.1 Content checks** (`vip/assertions/content.mts`)
- The home page, one article, `/archives` and `/search` load with the expected content. These are
  the first checks that load real pages through dotCMS's page API (D9).
- **Every article** *(Q4)*: each live article loads, with no 404. This would have caught CITGO's
  missing articles (F5), however their site is built.
- **Images:** every image used by live content exists. Check with `HEAD` requests sent straight to
  dotCMS; through the proxy, a `HEAD` downloads the whole image. Name each missing image.
- **Search:** searching for a live article's title finds that article.
- Keep requests few and spread out. Results can get long, which is why B6 matters.

**4.2 Running against a live site**
- One site per run: the site behind `--base-url`, matched by hostname, or named with `--site`
  (handy for a test address). To skip a site, don't schedule it (D12).
- Tag each check as settings-only, dotCMS, or live-site (`local`, `upstream`, `deployed`). A
  scheduled run skips settings-only checks, because they'd check the runner's copy of the code, not
  the live site.

**4.3 Scheduling (examples only)**
- Plain cron, which also fits GitLab, Jenkins, Azure DevOps or any server:
  `0 */2 * * * cd /app && npm run doctor -- --json --base-url https://…`
- GitHub Actions (`.github/workflows/watchdog.yml`): a problem fails the run. Run every 2 hours,
  not every 30 minutes: a 2-minute job every 30 minutes uses 2,880 minutes a month, more than the
  2,000 free minutes a private repo gets. That limit is GitHub's; other schedulers don't have it.
- For CITGO, the runner must be inside their network (Q5).

**4.4 Demo prep:** collect the screenshots taken along the way, and rehearse once.

Files: `.github/workflows/watchdog.yml`.

**Done when:** the scheduled run passes, and breaking an image reference makes it fail, naming the
image.

## Demo (30 minutes)

1. **Doctor, broken setup.** Point `FRONTEND_HOST_OVERRIDE` at a site that doesn't exist. The site
   quietly shows the wrong content; `npm run doctor` names the cause.
2. **Doctor, version drift.** The doctor warns that dotCMS changed since handover. (To demo it,
   edit `vip/baseline.json`.)
3. **Image caching.** DevTools before and after a second visit; quote the saving with its CDN
   caveat.
4. **Main image.** Before: Lighthouse flags the lazy hero. After: one image, loaded first.
5. **SEO, if built.** Flip `SITE_INDEXING`; the sitemap and structured data appear and disappear.
6. **Watchdog.** A failed run that names a broken image (and, with Q4, a missing article).

End with: every one of these was invisible in a project that passed review and shipped.

## Parked ideas

- **dotCMS call tracing (P1).** Deferred; notes for bringing it back are in D3.
- **Blurred image previews (LQIP).** Cut 2026-11-03. Each preview is small (494 B), but needs its
  own server request and is sent to the browser twice. Once caching works, the benefit is small.
- **Draft-leak check.** dotCMS can return unpublished related content
  ([evidence](./02-evidence.md#how-dotcms-works)); a check could flag unpublished articles inside a
  live Issue.
