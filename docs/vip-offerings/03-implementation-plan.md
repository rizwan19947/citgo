# VIP Offerings — MVP Implementation Plan

Build order for the full VIP suite on top of this project. Scope is unchanged from the
[feasibility study](./02-feasibility.md) — AVIF dropped, Watchdog merged into Preflight, P1's server
half scoped to dotCMS *call* tracing. Nothing else is cut.

**Calendar: 5 days. Work: ~8–10 days** (down from 9.5–11.5 after browser RUM was cut — see the
[client observability research](./04-client-observability-research.md)). Still a compression, roughly
12–14 hour days, but **the pre-GA dependency is off the critical path entirely** and Day 4 has slack
in it now.

**Sequence:** P2 → P4 → P5 → P1 → P3.

---

## Working under compression

Five rules that matter more than they would on a ten-day schedule.

1. **Front-load judgment, back-load typing.** Fatigue destroys debugging long before it slows typing.
   Each day below puts the work that needs thinking first and the mechanical work (JSON-LD, sitemap
   enumeration, the extraction refactor, workflow YAML) last. Follow that order even when the
   mechanical work feels like the easier start.
2. **Do not crunch against the dotCMS instance.** It is the client's live dev environment and the
   rate limiter is real (`x-dotratelimit-toks-max`). A tired engineer hammering a shared, rate-limited
   instance at 2am is the one way this work causes damage outside your own repo. **Cache probe
   responses to disk on first fetch** and develop against the cache.
3. **CI waits are free time.** Lighthouse runs and watchdog workflow runs take minutes. Queue them and
   keep moving; never sit watching a run.
4. **Capture demo evidence at the moment of the change**, not at the end. Day 5 has demo assembly but
   no room to go re-measure anything.
5. **Land each day's "must-land" before starting the next day's work**, even if the optional items
   slip. Each day names one. A half-finished pillar carried across a day boundary is how compressed
   schedules actually fail.

---

## Ground rules

1. **The dotCMS instance is read-only.** No content types, no fields, no plugins, no server config.
   Every check is a GET.
2. **Respect the rate limiter.** Cap concurrency; record `x-dotrequest-cost`.
3. **Repo conventions hold:** tabs not spaces, no `loader` prop on `<Image>`, `citgo-red` /
   `citgo-link` tokens never hardcoded, no `VERCEL_*` dependencies.
4. **Host-agnostic by construction.** Nothing may assume a hosting provider or a CI vendor. The
   deliverables are a **CLI** and a **library**; schedulers and workflow files are reference examples,
   not the product. Where behaviour genuinely differs by host — cold start, CDN caching — say so
   rather than assuming one.
5. **Keep blast radius small.** New code under `vip/` and `app/api/_vip/`; edits to existing files are
   surgical and listed per day.
6. **Every pillar ships behind an env flag**, default off.

### Surface area

```
vip/
  assertions/          shared check library (P2 + P3 both consume this)
    types.ts           Check, CheckResult, Severity
    env.ts             env completeness + SITE_N shape
    connectivity.ts    reachability, auth, version alignment
    proxy.ts           /dA round-trip + cacheability
    sites.ts           multisite resolution matrix
    content.ts         pages render, assets resolve, search works
    index.ts           registry + runner
  runners/
    cli.ts             npm run doctor
    report.ts          shared formatter (text + JSON)
  otel/
    server.ts          NodeSDK setup
    dotcms-span.ts     wraps SDK / proxy calls
  seo/                 extracted, parameterised metadata builders
  image/
    negotiate.ts       Accept -> format decision
    lqip.ts            /24w/30q -> data URI
app/api/_vip/
  preflight/route.ts
.github/workflows/
  watchdog.yml
  lighthouse.yml
```

---

## Day 1 — Foundation + P2 complete

*≈2 days of work. Must-land: `npm run doctor` green against the real instance.*

### Foundation (~2h)
`vip/assertions/types.ts`:
```ts
export type Severity = "error" | "warn" | "info";
export interface CheckResult {
	id: string; ok: boolean; severity: Severity;
	message: string; detail?: Record<string, unknown>; durationMs: number;
}
export interface Check {
	id: string; label: string; severity: Severity;
	run(ctx: CheckContext): Promise<CheckResult>;
}
```
`CheckContext` carries `{ siteConfigs, baseUrl, dotcmsHost, fetch }` — **injected, never read from
`process.env` inside a check**, so the same check runs locally and against a remote deployment. That
one decision is what makes Day 5 cheap. Put the disk-caching fetch wrapper (working rule 2) here.

Add `VIP_ENABLED`, `VIP_OTEL_ENABLED`, `VIP_SAMPLE_RATE` to `.env.example` (defaults off) and
`"doctor": "tsx vip/runners/cli.ts"` to `package.json`.

### Environment checks — `vip/assertions/env.ts`
- Required vars present: `DOTCMS_HOST`, `DOTCMS_AUTH_TOKEN`, `DEFAULT_SITE_HOST`, ≥1 `SITE_N`.
- `SITE_N` parses to exactly three parts, and **numbering has no gaps** — the loop in
  `utils/site-config.ts` stops at the first missing index, so `SITE_1, SITE_3` silently drops `SITE_3`.
- `siteIdentifier` looks like an identifier, not an inode.
- **`FRONTEND_HOST_OVERRIDE`, if set, matches a `SITE_N` hostname.** The documented silent-failure
  mode: no match resolves `siteId: undefined` and every dotCMS call fails quietly. Highest-value
  single check in the suite.
- `DEFAULT_SITE_HOST` matches a `SITE_N` hostname.

### Connectivity — `vip/assertions/connectivity.ts`
- Host reachable; record TLS and latency. Auth token valid (assert not 401/403).
- **Version alignment:** compare installed `@dotcms/client` against `x-dotcms-version` /
  `x-dotcms-min-sdk`. Warn on a mismatched line; error below the minimum. Currently core
  `26.08.19-04` vs SDK `1.4.0`.
- Record `x-dotratelimit-toks-max` as remaining budget context.

### Proxy — `vip/assertions/proxy.ts`
- `/dA/{knownAsset}` round-trips and returns an image content-type.
- **Assert the response is cacheable** — the check that would have caught tomorrow's defect.
- Assert no `DOTCMS_HOST` or token leakage in response headers.

### Multisite matrix — `vip/assertions/sites.ts`
For **every** `SITE_N`: `siteId` resolves to a real site, a live Issue exists,
`public/assets/{assetSlug}/header-logo.svg` exists on disk. Runs even when `FRONTEND_HOST_OVERRIDE`
pins one site, because multisite is foundational here.

### Runners *(mechanical — do this last)*
- `vip/runners/report.ts` — shared formatter, text and JSON.
- `vip/runners/cli.ts` — table output, `--json`, non-zero exit on any `error`.
- `app/api/_vip/preflight/route.ts` — same registry, JSON body, 200/503 by worst severity. **Gate on
  `VIP_ENABLED`, 404 when off.**

**Done when:** doctor is green, and breaking `FRONTEND_HOST_OVERRIDE` names the cause precisely.

---

## Day 2 — P4 complete

*≈2 days of work. Must-land: the caching fix, measured, with before/after captured.*

### Fix the caching defect — `app/dA/[...path]/route.ts` *(first thing, ~2h)*
```ts
const cacheControl = res.headers.get("cache-control") || "public, max-age=31536000, immutable";
//                   ^ returns "no-cache", so the fallback is dead code
```
`/dA` assets are content-addressed by identifier and immutable in practice. Override rather than
inherit, and emit `Vary: Accept` since the next step makes the response depend on it.

**Measure and screenshot before moving on.** This is the demo's headline number and the single
biggest measured win in the suite.

**Caveat the number when you quote it.** The header is correct on any host, but whether it yields a
*hit* depends on what sits in front: some CDNs also want `s-maxage` or `CDN-Cache-Control`, and an
origin with no CDN gets browser caching only. The fix is portable; the measured delta is specific to
the demo's edge. Do not let it be quoted as a universal figure.

### Accept forwarding + negotiation — `vip/image/negotiate.ts`
- Forward the browser's `Accept` upstream in the proxy.
- Because dotCMS ignores it entirely (measured: it returned WebP even to `Accept: image/jpeg`),
  decide format **frontend-side**. Since `{n}q` already yields WebP universally, the real decision is
  WebP versus an explicit `/jpeg` fallback for clients that do not advertise WebP.
- **No AVIF.** Leave a commented rationale pointing at the measurements so the next engineer does not
  "fix" its absence.

### LQIP — `vip/image/lqip.ts`
`/dA/{id}/24w/30q` measures 494 bytes → ~660 chars of base64 inlined per image. Fetch server-side,
base64 into a data URI, pass as `placeholder="blur" blurDataURL={…}`. Cache per identifier for the
process lifetime; never block render on it.

**Apply it selectively.** Every route here is server-rendered per request with no ISR, so the inlined
base64 rides on every HTML response, uncached. It earns its bytes on the hero and the card grid. It
does *not* on the 100px sidebar and search thumbnails — those are 2,128 B at the applied quality, so a
660 B placeholder is 31% of the real image to smooth a flash on something that arrives almost
instantly. Hero and cards only.

### Fix adaptive quality — `utils/imageLoader.ts`
Render width is the *right* input — it is what Next.js knows and it already includes DPR. The mapping
is what is wrong, in two ways.

**It is inverted.** The ladder is `≤375→q25 · ≤640→q30 · ≤768→q37 · ≤1024→q50 · else→q75`, so it
compresses hardest where there is least to win and not at all where the bytes actually are:

| Render width | Applied q | Bytes | Bytes at q75 | Saving |
|---|---|---|---|---|
| 100w | 25 | 2,128 | 3,674 | 1,546 B |
| 400w | 30 | 14,142 | 26,530 | 12,388 B |
| 1920w | **75** | **135,808** | 135,808 | **0 B** |

Dropping the hero from q75 to q50 saves more than every thumbnail on the page combined.

**q25 is below the artifact floor at any dimension.** Compression artifacts are per-pixel — a pixel in
a 100px thumbnail occupies the same screen area as a pixel in a 1920px hero, so blocking and banding
are equally visible in both. Small images have *fewer* artifacts, not less visible ones. For WebP
photographic content, visible degradation starts around q40–50. DPR compounds it: a 100px CSS
thumbnail on a 3× phone requests 300w, still lands in the `≤375` bucket, and gets q25 on the display
where artifacts show most.

**Fix:** flatten the curve. One quality in the 55–65 range, letting the resize do the byte-saving it
already does well. If genuine device-awareness is wanted, read the `Save-Data` request header in the
proxy (and add it to `Vary`) — an actual client signal, which is what the divisor was reaching for and
width cannot provide.

### Art direction *(mechanical — do this last)*
`mobileImage` / desktop swapping exists in `HomePage.tsx` and `Banner.tsx` as duplicated
`hidden md:block` pairs, which downloads **both**. Formalise into a single `<picture>` with `media`
sources so only one is fetched.

**Done when:** repeat navigation serves from cache, LQIP renders, only one image per breakpoint is
fetched.

---

## Day 3 — P5 complete + P1 server half

*≈2 days of work. Must-land: dotCMS call spans reaching a backend.*

### P1 server spans — `instrumentation.ts` + `vip/otel/server.ts` *(judgment work — do first, ~half day)*
This is now the whole of P1's hard part, since browser RUM is cut.

- Auto-detected in Next.js 15+, no config flag.
- Prefer a manual `@opentelemetry/sdk-node` `NodeSDK` over `@vercel/otel` — the repo is deliberately
  cloud-agnostic and OTel was chosen for neutrality. (`@vercel/otel` remains the known escape hatch
  if OTel's require-hooks fight Next's bundling; reach for `serverExternalPackages` first.)
- OTLP exporter, endpoint from env, head sampling from `VIP_SAMPLE_RATE` with a conservative default.
- **Register `http` and `undici` only.** Do *not* use `@opentelemetry/auto-instrumentations-node` — it
  registers dozens of instrumentations this app has no use for (gRPC, Redis, Postgres, Mongo, AWS
  SDK), each hooking module loading. `undici` covers `fetch`, which is how the SDK and the `/dA`
  proxy talk out. That is the entire surface needed.

Stand up the Grafana Cloud free-tier backend now, not on Day 4 — you want the pipe proven before the
hard part.

**Overhead, and where it lands.** Client bundle: zero — server-side only. Per request: ~6 spans at
low-microsecond cost each, invisible against an app that spends over a second in dotCMS round-trips.
The real cost is **process start**, and it depends on the deployment target, not the vendor: on a
container or VM (`next start`, Docker, ECS, Cloud Run with warm instances) it is paid once at boot and
amortises to nothing; on any **serverless/FaaS** target it is paid per cold start, and
`BatchSpanProcessor` may need a force-flush before the function freezes — which does add latency to
the response. Decide that deliberately for the target at hand. Head sampling cuts creation cost too,
not just egress: unsampled spans are non-recording.

Measure rather than trust the estimate — p50/p95 with `VIP_OTEL_ENABLED` off, then on. Ten minutes,
and it gives you a real number for the demo.

### P1 dotCMS call spans — `vip/otel/dotcms-span.ts` *(~half day)*
Wrap `utils/dotCMSClient.ts` and the `/dA` route with spans carrying operation, `siteId`, path,
status, duration, and the `x-dotratelimit-*` / `x-dotrequest-cost` headers. **Wrap only the public
call surface, never SDK internals**, so SDK churn cannot break instrumentation.

**Partition by site.** `siteId` goes on every span as a first-class attribute, and a
`VIP_TRACE_SITES` env list selects which sites participate — include/exclude, so either dotCMS or the
client can leave a site out. Multisite is foundational here, so this is a requirement, not a nicety.

**Scrub the search query.** `/search?q=` is the only place user-typed text enters a URL on these
sites. Strip `q` before it reaches span attributes. Everything else — `/{issueSlug}/{articleSlug}` —
is public by construction. One line, and it closes the PII question.

This is the pillar's real payload: *"is dotCMS slow, or are we?"* per request.

### P5 — SEO & Performance *(mechanical — do this second half)*
- **Extract** `utils/getMetadata.ts` into `vip/seo/` as a config-driven module. The current builders
  hardcode `"CITGO"` and the `https://${hostname}` pattern; parameterise and keep call sites working.
- **Sitemap** — `app/sitemap.ts` enumerating live issues and articles per resolved site, gated on
  `SITE_INDEXING` so it stays fail-closed. Add the `Sitemap:` line to `robots.ts` only when indexing
  is on.
- **JSON-LD** — `Article` and `BreadcrumbList` structured data on detail pages, same gate.
- **Lighthouse CI** — `.github/workflows/lighthouse.yml` asserting LCP / CLS / TBT and total image
  weight. **Assert on the performance category, not the SEO score** — the "blocked from indexing"
  audit fails by design. Queue the first run and keep working.

**Done when:** call spans are visible in Grafana, the sitemap and JSON-LD toggle with
`SITE_INDEXING`, and Lighthouse fails on a deliberately regressed budget.

---

## Day 4 — P1 dashboard + integration story

*≈1 day of work. Must-land: dotCMS call spans and a working dashboard.*

> **Rescoped 2026-09-09** after the [client observability research](./04-client-observability-research.md).
> Browser RUM is cut: almost all target enterprises already run Datadog/New Relic, whose RUM SDKs
> already inject W3C `traceparent` and already display OTel backend traces. Building our own duplicates
> a product they own, behind a pre-GA SDK. **This was the risk day; it no longer is.**

### Verify inbound trace context *(verify, do not build — ~1h)*
OTel's default global propagator is `W3CTraceContextPropagator`, so an inbound `traceparent` on a
request is extracted automatically and our spans become children of the client's RUM trace. Confirm
it with a hand-crafted `traceparent` header and check the span parents in Grafana. **This is the whole
browser-correlation story** — it is configuration to verify, not code to write.

### Dashboard
Core Web Vitals from Lighthouse over time, dotCMS call latency by operation, `/dA` cache-hit ratio,
error rate, rate-limit consumption from `x-dotratelimit-*`.

### Core Web Vitals scorecard
A plain, non-engineer-readable view for the marketing/content audience, rendered from the Lighthouse
JSON produced on Day 3. They will never open a tracing UI; give them a scorecard.

### "Bring your own RUM" documentation
The deliverable that replaces the code. A worked integration example for Datadog and New Relic showing
their RUM agent correlating with our spans. Note the ePrivacy consent obligation — RUM setting a
session identifier needs consent, and `components/CookieBanner.tsx` is an acknowledgement banner, not
a consent manager.

### Not built, documented only
The `web-vitals` beacon, for the minority of clients with no RUM at all — ~2 hours if one needs it.
Ship as sample code in the docs, not as part of the product.

**Done when:** a hand-crafted `traceparent` produces correctly parented spans, and the dashboard shows
call latency, cache-hit ratio and vitals.

### Freed capacity — ~1.5 days
Spend it on the gap the research surfaced: **preview error rates as a release-gating SLO**, which
appears in the enterprise CMS literature and is absent from the suite. Otherwise, hold it as slack
against the crunch.

---

## Day 5 — P3 complete + demo

*≈1.5–2 days of work. Deliberately the lightest day: it is the buffer.*

### Content checks — `vip/assertions/content.ts` *(cheap — the assertions already exist)*
- Home, one article detail, `/archives`, `/search` return 200 with expected markers.
- Crawl live content for image identifiers, HEAD each `/dA/{id}`, report any that 404. Cap concurrency
  and respect the rate limiter.
- `/api/search?q={knownTerm}` returns `total > 0`.

### Scheduler — reference example, not the product
The deliverable is `npm run doctor` plus the assertion library — both host- and CI-agnostic because
`CheckContext` is injected rather than read from the environment. A scheduler is a thin wrapper, and
GitHub Actions is one example among several. Ship a plain cron invocation alongside it
(`*/0 */2 * * * cd /app && npm run doctor -- --json`) so a client on GitLab CI, Jenkins, Azure DevOps
or a bare VM has a path that does not involve rewriting anything.

#### `.github/workflows/watchdog.yml`
- Fail the run and open or update an issue on regression.
- Emit results as OTel spans, tagged with `siteId`, so watchdog failures land on the same dashboard
  as the call spans.
- **Honour the same `VIP_TRACE_SITES` include/exclude list** as tracing, so a site the client does not
  want monitored is never probed. Checks run per site and report per site.
- **Every 2 hours, not every 30 minutes** — a 2-minute check at 30-minute intervals is 2,880 min/month
  against GitHub's 2,000-minute private-repo allowance. *That budget is GitHub-specific*; a
  self-hosted runner or cron has no such ceiling, so state the constraint as an example rather than a
  rule of the suite.

### Demo assembly
Dashboard polish, the screenshots collected through the week, one full rehearsal.

**Done when:** the workflow runs green on schedule, and deliberately breaking an asset reference turns
it red with the specific identifier named.

---

## Demo script (30 minutes)

1. **Break the wiring** — point `FRONTEND_HOST_OVERRIDE` at an unconfigured host; the site fails
   silently, `npm run doctor` names the cause. *(P2)*
2. **Version drift** — core `26.08.19-04` vs SDK `1.4.0`, flagged automatically. *(P2)*
3. **Caching** — DevTools before/after on a repeat navigation; quote the measured delta. *(P4)*
4. **LQIP** — throttle to Slow 3G; blurred placeholders instead of empty boxes. *(P4)*
5. **SEO** — toggle `SITE_INDEXING`; sitemap and JSON-LD appear and disappear. *(P5)*
6. **One trace** — load a page, open Grafana, walk a single trace from browser vitals through the
   server span into the dotCMS call. *(P1)*
7. **Watchdog** — a red run naming a specific broken asset identifier. *(P3)*

Close on the framing from the feasibility study: every one of these was invisible in a project that
passed review and shipped.

---

## Out of scope

- Any **write** to the dotCMS instance — content types, fields, plugins, config.
- Tracing inside dotCMS core (no OTel in core; instance is read-only).
- AVIF — measured regression, 35,740 B vs WebP's 28,200 B, and tuned AVIF is unreachable through the
  filter ordering.
- **Browser RUM.** Clients already own it; their agents already propagate W3C `traceparent` and
  already display OTel backend traces. A `web-vitals` beacon ships as documented sample code for the
  minority with none.
- Multi-tenant managed hosting of any backend.
- Alerting, SLOs, anomaly detection — the APM boundary flagged for Staff Engineer review.
- Draft/preview visibility.
- Any change to the site's rendering strategy — routes stay server-rendered per request; no ISR or
  revalidation is introduced.
