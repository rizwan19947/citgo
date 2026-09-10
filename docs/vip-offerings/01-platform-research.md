# dotCMS as a Headless Platform — Research Baseline

Context for the VIP Offerings feasibility study. Everything here is either sourced from dotCMS
documentation/npm or measured directly against the CITGO dev instance (`26.08.19-04`) on 2026-09-03.

## 1. What dotCMS is

A Java-based **hybrid headless CMS** — a traditional page/site management core (multi-site, containers,
templates, URL maps, permissions, workflow) with headless delivery bolted on top, rather than an
API-first product that grew a UI. Editions: Cloud (SaaS), Enterprise (on-prem), Community (GPL-3.0).
Licensing is **per JVM**, with no seat or site limits — which is why multi-site is cheap to sell and
why a multi-site frontend story matters commercially.

The hybrid heritage is the single most important fact for this initiative. It means the headless
surface inherits assumptions from the page-rendering core (URL maps, container layouts, the `/dA`
asset pipeline), and those assumptions leak into frontend code in ways a purely API-first CMS would
not produce.

## 2. Headless surface area

| Capability | Vehicle | Maturity |
|---|---|---|
| Page delivery | Page API (GraphQL-backed), `client.page.get()` | Solid; drives layout + `urlContentMap` |
| Content queries | Content API, Lucene or builder DSL | Solid; `.depth()`, `.draft()`, `.variant()` |
| Navigation | `client.nav` | Present, unused here |
| In-context editing | Universal Visual Editor (UVE) + framework SDKs | Newest, most fragile |
| Assets/imaging | `/dA` endpoint with filter chain | Powerful, poorly surfaced |
| AI | `client.ai` | Marked `@experimental` in the SDK |

### SDK maturity — the numbers

`@dotcms/client` on npm: first published **2024-01-03** as `0.0.1-alpha.0`; **285 versions** in ~20
months; versioning scheme changed twice (alpha → semver → CalVer). Current `latest` is `26.9.2-1`
(published 2026-09-02, the day before this study).

**This project pins `1.4.0`** — the abandoned semver line. The instance it talks to runs
`26.08.19-04`, and an SDK build `26.8.19-4` exists that matches it exactly.

That gap is not a criticism of this project; it is the predictable result of a 285-release cadence
with a mid-flight versioning change. It is also the strongest single argument for the Config
Preflight pillar: **version drift between frontend SDK and backend core is a structural, recurring
failure mode on this platform, not a one-off mistake.**

Usefully, dotCMS already emits the raw material for detecting it. Every response carries:

```
x-dotcms-version: 26.08.19-04
x-dotcms-min-sdk: 0.0.0
```

`x-dotcms-min-sdk` exists precisely to let a client assert compatibility. Nothing in the SDK or in
this project reads it today.

## 3. The `/dA` image pipeline — measured behaviour

Documented filter chain: resize (`{n}w|h|maxw|maxh|minw|minh`), crop (`{n}cw|ch`, `{f},{f}fp`),
resample (`{1-15}ro`), format (`/jpeg`, `/jpegp`, `/webp`, `/avif`), quality (`{1-100}q`).
Format-conversion filters **must come last**.

Measured against a real live Article image (`78884204eaf5b3d0665e71bde2c9ae15`):

| Request | Content-Type | Bytes |
|---|---|---|
| `/dA/{id}` | image/jpeg | 39,903 |
| `/dA/{id}/800maxw/75q` | **image/webp** | 28,200 |
| `/dA/{id}/800maxw/webp` | image/webp | 28,200 |
| `/dA/{id}/800maxw/avif` | image/avif | **35,740** |
| `/dA/{id}/800maxw/jpeg` | image/jpeg | 38,534 |
| `/dA/{id}/800maxw/40q/avif` | **image/webp** (!) | 17,852 |
| `/dA/{id}/24w/30q` | image/webp | **494** |

WebP quality ladder at `800maxw`: 30q=16,304 · 40q=19,006 · 50q=21,392 · 60q=24,058 · 75q=28,200 ·
85q=39,904.

Four conclusions, each load-bearing for the Image pillar:

1. **The `{n}q` filter already emits WebP.** The existing `imageLoader.ts` has been getting WebP for
   free since it was written. "Add WebP" is not net-new value.
2. **There is no content negotiation.** The docs state Safari receives JPEG. It does not — the
   endpoint returned WebP to a Safari User-Agent *and* to `Accept: image/jpeg`. Negotiation, if
   wanted, has to be implemented frontend-side.
3. **AVIF is enabled here but is a regression.** 35,740 B vs 28,200 B for WebP — 27% *worse*. And
   quality-tuned AVIF is unreachable: `/40q/avif` silently returns WebP, because the quality filter
   is itself a conversion filter and wins the ordering rule.
4. **LQIP is trivially available.** `/24w/30q` = 494 bytes, small enough to inline as a data URI.

### The caching defect

```
cache-control: no-cache
vary: (absent)
```

dotCMS returns `no-cache` on asset responses and no `Vary`. The project's asset proxy does:

```ts
const cacheControl = res.headers.get("cache-control") || "public, max-age=31536000, immutable";
```

Because the header *is* present, the `||` fallback never fires. **Every image on every CITGO site is
served `no-cache`** — the intended year-long immutable caching has never been active. Separately, the
proxy does not forward the browser's `Accept` header upstream, so origin-side negotiation could not
work even if dotCMS implemented it.

Both are real defects in a project already handed to a client, found in under an hour. They are the
most persuasive evidence available that this offering addresses a genuine gap.

## 4. Rate limiting

Asset responses carry `x-dotratelimit-toks-max: 100000/100000` and `x-dotrequest-cost: 0.00`. A
token-bucket limiter is active and per-request cost is exposed. Any synthetic-monitoring pillar must
treat this as a metered budget, and the same headers are a free observability signal worth recording
as span attributes.

## 5. Where dotCMS sits competitively

> **Revised 2026-09-09.** An earlier draft of this section claimed the category was empty. That was
> wrong — see [client observability research](./04-client-observability-research.md).

| Vendor | Ships | Shape |
|---|---|---|
| **Contentful** | *Enterprise Observability* — Content Delivery API and GraphQL logs streamed to S3 / GCS / Azure Blob, for routing into Datadog, Splunk or Grafana | Export into the customer's own stack |
| **Sanity** | *Content Source Maps* + stega encoding — rendered UI traced back to source fields | Content provenance |
| **Contentstack** | Nothing found | — |
| **Anyone** | Browser RUM, wiring validator, asset watchdog | Nobody |

Two things follow. First, dotCMS is **behind** Contentful on delivery-layer telemetry, not ahead —
worth knowing before this is pitched internally as category-defining. Second, and more useful:
Contentful's answer is an **export into the customer's own stack**, not a dashboard product. They
arrived independently at the model this initiative should follow, which is decent evidence it is the
right one.

The remaining gaps — a wiring validator, a content-aware asset watchdog — are genuinely unserved by
anyone. The warning also stands: this sits between "CMS vendor" and "APM vendor", and customers
already own the second relationship.

## 6. Practical constraints carried into feasibility

- **The CITGO instance is read-only.** No content types, no fields, no plugins, no server config.
- **dotCMS core emits no OpenTelemetry.** Server-side tracing of the Java core is out of scope by
  both constraint and intent; OTel here instruments the *headless frontend*.
- **UVE is the least mature surface** and the most likely to break under SDK churn.
- **Draft visibility is unsolved platform-wide** — `.depth()` returns related contentlets regardless
  of publish state, so drafts leak. Out of scope here, but it is the kind of defect a Preflight
  pillar could learn to detect.

## Sources

- [SDK: @dotcms/client Library](https://dev.dotcms.com/docs/build/headless-and-sdks/sdk-libraries/sdk-client-library)
- [Headless SDK](https://dev.dotcms.com/docs/headless-sdk)
- [Image Resizing and Processing](https://dev.dotcms.com/docs/build/apis/api-basics/image-resizing-and-processing)
- [Universal Visual Editor Configuration for Headless Pages](https://dev.dotcms.com/docs/uve-headless-config)
- [dotCMS Features — Enterprise, Cloud, Community](https://www.dotcms.com/product/features)
- npm registry metadata for `@dotcms/client` (285 versions, retrieved 2026-09-03)
- Direct measurement against the CITGO dev instance, 2026-09-03
