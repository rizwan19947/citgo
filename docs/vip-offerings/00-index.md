# VIP Offerings — Start Here

Orientation for anyone picking this up cold. **Nothing has been implemented yet** — as of
2026-09-11 this initiative is four planning documents and zero lines of code.

## What this is

A suite of add-ons sold or standardised on top of a headless dotCMS frontend, prototyped on this
CITGO project. Five pillars:

| | Pillar | What it does |
|---|---|---|
| **P1** | Frontend Observability | OTel **server-side** spans around dotCMS SDK calls and the `/dA` proxy, exported over OTLP |
| **P2** | Config Preflight ("Headless Doctor") | Validates env, connectivity, SDK↔core version alignment, proxy, multisite resolution |
| **P3** | Synthetic + Asset Watchdog | P2's assertions on a schedule, plus content-aware checks |
| **P4** | Image / DAM Pipeline | Caching fix, LQIP, quality correction, art direction |
| **P5** | SEO & Performance Baseline | Extract existing SEO work, add sitemap + JSON-LD, Lighthouse CI |

## The documents

| Doc | Read it for |
|---|---|
| [01-platform-research](./01-platform-research.md) | dotCMS as a platform, SDK maturity, the `/dA` filter chain, competitive picture |
| [02-feasibility](./02-feasibility.md) | Should we build it, effort, cost, pros/cons, packaging recommendation, decisions taken |
| [03-implementation-plan](./03-implementation-plan.md) | **The build plan.** Day-by-day, file paths, acceptance criteria |
| [04-client-observability-research](./04-client-observability-research.md) | Why browser RUM was cut |

## Decisions already settled — do not re-litigate

- **Browser RUM is cut.** Target enterprises already run Datadog/New Relic, whose RUM SDKs already
  inject W3C `traceparent` and display OTel backend traces. We accept inbound trace context and stop
  there. A `web-vitals` beacon ships as *documented sample code*, not product.
- **OTel is still in scope** — server-side only. Cutting RUM did not cut OpenTelemetry.
- **AVIF is dropped.** Measured on the live instance: 35,740 B vs WebP's 28,200 B, and quality-tuned
  AVIF is unreachable because `/40q/avif` silently returns WebP.
- **P3 is P2's assertions on a timer.** One shared library, three runners. `CheckContext` is
  *injected*, never read from `process.env` inside a check — that is what makes P3 cheap.
- **Scope is frontend only.** Backend and admin-panel observability belong to the product team.
- **Host- and CI-agnostic.** The deliverables are a CLI and a library; schedulers and workflow files
  are reference examples. No `VERCEL_*`, no assumed CDN, no assumed CI vendor.
- **Packaging:** internal reference architecture → PS accelerator → productised SKU only if adoption
  proves it.

## Hard constraints

1. **The dotCMS instance is read-only.** It is the client's live dev environment, already handed off.
   No content types, no fields, no plugins, no server config. Every check is a GET.
2. **A rate limiter is live** (`x-dotratelimit-toks-max`). Cap concurrency; cache probe responses to
   disk while developing.
3. **Repo conventions:** tabs not spaces, no `loader` prop on `<Image>`, `citgo-red` / `citgo-link`
   tokens never hardcoded.
4. **Budget:** 5 calendar days, ~8–10 days of work.

## Measured evidence — do not re-probe the client's instance

All taken 2026-09-03 against dotCMS `26.08.19-04`, asset `78884204eaf5b3d0665e71bde2c9ae15`.

```
/dA/{id}                    image/jpeg   39,903 B
/dA/{id}/800maxw/75q        image/webp   28,200 B      ← {n}q already yields WebP
/dA/{id}/800maxw/webp       image/webp   28,200 B
/dA/{id}/800maxw/avif       image/avif   35,740 B      ← worse than WebP
/dA/{id}/800maxw/40q/avif   image/webp   17,852 B      ← q filter wins; avif ignored
/dA/{id}/800maxw/jpeg       image/jpeg   38,534 B
/dA/{id}/24w/30q            image/webp      494 B      ← LQIP source

WebP quality ladder @800maxw:  30q=16,304  40q=19,006  50q=21,392  60q=24,058  75q=28,200  85q=39,904
Quality vs width:  100w q25=2,128 (q75=3,674) · 400w q30=14,142 (q75=26,530) · 1920w q75=135,808

Response headers:  cache-control: no-cache        ← the fallback in the /dA proxy is dead code
                   vary: (absent)
                   x-dotcms-version: 26.08.19-04
                   x-dotcms-min-sdk: 0.0.0        ← placeholder; nothing reads it
                   x-dotratelimit-toks-max: 100000/100000
                   x-dot-server: dotcms-citgo-dev-{0,1}|…   ← multiple nodes

Content API body:  queryTook, contentTook, resultsSize   ← internal timings, undecided whether to capture
Negotiation:       the {n}q filter ignores BOTH User-Agent and Accept — returns WebP to `Accept: image/jpeg`
```

## Live defects in this project, found by that probing

1. **Every image is served `no-cache`.** `app/dA/[...path]/route.ts` does
   `res.headers.get("cache-control") || "…immutable"` — dotCMS *does* send `no-cache`, so the
   fallback never fires. Highest-ROI fix in the suite.
2. **The proxy forwards only `Authorization`**, dropping the browser's `Accept`.
3. **SDK `1.4.0` vs core `26.08.19-04`** — different versioning lines, unvalidated.
4. **`getAdaptiveQuality()` is inverted** — compresses hardest where the fewest bytes are.

## Where to start

[Day 1 of the implementation plan](./03-implementation-plan.md#day-1--foundation--p2-complete):
`vip/assertions/types.ts`, then env and connectivity checks. Must-land is `npm run doctor` green
against the real instance.

## Still open

One question, reserved for Staff Platform Engineer review: **where does the suite stop relative to
alerting, SLOs and dashboards?**
