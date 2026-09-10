# VIP Offerings — Feasibility Study

**Question:** should we build an MVP of the VIP add-on suite, on top of the CITGO headless frontend,
in ~2 weeks?

> **Revised 2026-09-09/11.** Two changes since first draft. (1) The calendar compressed to **5 days**
> — a schedule change, not a scope cut. (2) **Browser RUM was cut** after the
> [client observability research](./04-client-observability-research.md) found that target
> enterprises already own it and their agents already propagate W3C `traceparent`. Net work is now
> **~8–10 days** across five, and the pre-GA dependency is off the critical path. Everything else in
> this study stands.

**Answer: yes — with two pillars rescoped and one merged.** The suite addresses a real, unserved gap;
four of five pillars need no infrastructure beyond the existing deployment; and the strongest proof
point already exists in the form of two live defects this study found in a handed-off project. The
serious risks are not technical feasibility — they are **support surface** and **scope drift into
APM**, and both are packaging decisions rather than engineering ones.

Companion documents: [platform research](./01-platform-research.md) ·
[implementation plan](./03-implementation-plan.md).

---

## 1. The suite, as scoped

Pillars 1–4 are from the original plan. Pillar 5 folds in the SEO and performance work already
shipped in this project.

### P1 — Frontend Observability
Server spans in the Next.js runtime around every dotCMS SDK call and `/dA` proxy hop, exported over
OTLP to a customer-owned backend, and accepting inbound `traceparent` so they join whatever RUM the
client already runs.

> **Browser RUM cut 2026-09-09** — see [client observability research](./04-client-observability-research.md).
> Almost all target enterprises already run Datadog/New Relic, whose RUM SDKs already inject W3C
> `traceparent` and already display OTel backend traces. Building our own duplicates a product they
> own, behind a pre-GA SDK, and triggers an ePrivacy consent obligation this project's
> acknowledgement-only cookie banner cannot satisfy. A `web-vitals` beacon ships as documented sample
> code for the minority of clients with no RUM.

> **Rescoped.** The whiteboard says "dotCMS server tracing". dotCMS core emits no OpenTelemetry and
> our instance is read-only, so tracing the Java core is impossible for this MVP. What is achievable
> — and delivers most of the diagnostic value — is instrumenting the *frontend's* calls to dotCMS:
> latency, status, query shape, and the `x-dotratelimit-*` / `x-dotrequest-cost` headers, per call.
> That answers "is dotCMS slow or are we?" without touching the backend. The pillar should be named
> to reflect that, so it does not read as a promise to instrument core.

### P2 — Config Preflight ("Headless Doctor")
Validates that a headless deployment is wired correctly before it serves traffic: env completeness
and shape, DotCMS reachability and token validity, **SDK↔core version alignment** (via the
already-emitted `x-dotcms-min-sdk`), `/dA` proxy round-trip, and the full single/multi-site
resolution matrix. Ships as a CLI (`npm run doctor`), a `/api/_health/preflight` endpoint, and a CI
gate.

### P3 — Synthetic + Asset Watchdog
The same assertions as P2, run on a schedule against a deployed URL, plus content-aware checks: key
pages render, `/dA` assets referenced by live content actually resolve, search returns results.

> **Merge with P2.** These are not two bodies of code. A watchdog is a preflight run on a timer
> against a remote target. Building one assertion library consumed by three runners (CLI, endpoint,
> scheduler) removes roughly a day of duplicated work and guarantees the two never disagree.

### P4 — Image / DAM Pipeline
Format negotiation, LQIP placeholders, art direction — plus the caching and header defects found in
§3 below.

> **Drop AVIF.** Measured on the live instance: AVIF is **27% larger** than WebP (35,740 B vs
> 28,200 B), and quality-tuned AVIF is unreachable because `/40q/avif` silently returns WebP — the
> quality filter is itself a conversion filter and wins the ordering rule. Shipping AVIF today makes
> images worse. Keep it as a documented "revisit when dotCMS exposes AVIF quality control".

### P5 — SEO & Performance Baseline *(new — from existing work)*
Already built here: `utils/getMetadata.ts` (article/page/issue builders with sensible fallbacks), the
fail-closed `SITE_INDEXING` gate, per-site canonicals and OG/Twitter tags, `robots.ts`, self-hosted
fonts via `next/font/local`, and React `cache()` request dedup. Productising means extracting it into
a reusable module, adding the two pieces deliberately skipped (sitemap, JSON-LD) behind the same env
gate, and adding a Lighthouse CI budget so regressions fail the build.

This pillar is the cheapest in the suite because most of it is written. It is also the easiest to
sell, because SEO is a line item every enterprise buyer already understands.

---

## 2. How the suite holds together

```
Config Preflight ──validates──▶ dotCMS SDK ──▶ /dA proxy ──▶ imageLoader
       │                            │              └──────┬──────┘
       │                            │                     │
       │                            │              Image Pipeline
       │                            │           (optimises what flows)
       │                            ▼
       └──shared assertions──▶ Watchdog          SEO/Perf Baseline
                        (guards live traffic)   (what the output must meet)

              Observability instruments every arrow above
```

Preflight proves the wiring is right *once*; the Watchdog proves it stays right; the Image Pipeline
and SEO baseline govern the quality of what flows through; Observability measures all of it in
production. The bundle's claim — *performant, reliable, observable, correctly wired* — is coherent
because each pillar covers a different failure mode of the same pipeline.

---

## 3. Evidence the gap is real

Found in the CITGO project in under an hour, by direct measurement:

| # | Defect | Evidence | Impact |
|---|---|---|---|
| 1 | **All images served `no-cache`** | dotCMS returns `cache-control: no-cache`; the proxy's `\|\| "max-age=31536000, immutable"` fallback therefore never fires | Every image refetched on every navigation. Origin load, bandwidth, and rate-limit budget all multiplied. Highest-ROI fix in the suite. |
| 2 | **Proxy drops the `Accept` header** | `app/dA/[...path]/route.ts` forwards only `Authorization` | Browser capability never reaches origin; negotiation impossible by construction |
| 3 | No `Vary` on asset responses | `vary: null` | Any future negotiation would be unsafe to cache |
| 4 | SDK pinned `1.4.0` vs core `26.08.19-04` | `package.json` vs `x-dotcms-version` | Unvalidated drift; `x-dotcms-min-sdk` exists and nothing reads it |
| 5 | **Adaptive quality is inverted** — hardest compression where the fewest bytes are | `getAdaptiveQuality()` maps render width to a divisor: `≤375→q25`, `≤1024→q50`, else `q75`. Measured: 100w saves 1,546 B at q25; a 1920w hero saves nothing because it gets full q75 | The policy compresses hardest where ~1.5 KB is at stake and not at all where 135 KB is. Separately, q25 is below the visible-artifact floor at *any* dimension, and DPR means a 100px thumbnail on a 3× phone requests 300w and still lands in the q25 bucket |

This is the pitch, and it is worth more than any slide: a competent team shipped a good project, and
the delivery layer still had two live defects that no test, review, or Lighthouse run would surface.
That is exactly the class of problem the suite exists to catch.

**Caveat for honesty in the sales narrative:** #1 and #2 are defects in *our own* reference project.
Framing them as "look what we found in a client build" is accurate but double-edged. Frame them
instead as *why we built the tooling* — the team that wrote this code is the team that could not see
these without instrumentation.

---

## 4. Effort

> **Recalendared 2026-09-09** — the same work, compressed from 10 days into 5. The estimates below
> are unchanged and remain the honest figure; what changed is that they are now absorbed by ~14–16
> hour days rather than by cutting scope.

Solo, 10 working days, crunch available. Estimates assume the merges and drops above.

| Pillar | Est. | Infra needed | Certainty |
|---|---|---|---|
| P2 Preflight | 1.5–2 d | none | **High** — pure frontend, deterministic |
| P4 Image Pipeline | 2–2.5 d | none | **High** — measured behaviour, AVIF dropped |
| P5 SEO/Perf | 1–1.5 d | none | **High** — mostly extraction |
| P3 Watchdog | ~1 d *(post-merge)* | scheduler only | Medium — reuses P2 assertions |
| P1 Observability *(RUM cut)* | ~1.5 d | OTLP backend | **High** — server spans only |
| | **~8–10 d** | | |

Compressed into 5 calendar days that is roughly **12–14 hour days** — a schedule decision, not an
estimating one. The original figure was 8.5–11 days with P1 at 3–4 and rated Low–Medium certainty;
cutting browser RUM removed both the largest single estimate and the only pre-GA dependency, so what
remains is high-certainty work that responds to hours in the way the browser SDK never would have.

A `web-vitals` beacon remains available as documented sample code for a client with no RUM of their
own — roughly two hours — but it is not built as part of the MVP.

**Sequencing matters more than the totals.** P4 modifies the `/dA` proxy; P1 instruments it. Doing
P1 first means redoing spans. Correct order is P2 → P4 → P5 → P1 → P3, which also front-loads the
three high-certainty pillars so that a bad week in P1 still leaves a demonstrable suite.

### The P1 risk, specifically
Server-side OTel in Next.js is a solved problem — `instrumentation.ts` is auto-detected in Next 15+,
and a manual `NodeSDK` instruments App Router server components and route handlers. Register `http`
and `undici` only — `auto-instrumentations-node` pulls dozens of irrelevant integrations. Client
bundle cost is zero (server-side only); the one real cost is process start, which amortises to
nothing on a container or VM and is paid per cold start on serverless targets. Budget ~1 day.

Browser RUM is not solved. The OpenTelemetry Browser SDK is still in progress; there is **no official
web-vitals instrumentation package**; Elastic's distribution is tech preview and Honeycomb's wrapper
is beta. The working pattern is to capture vitals with the `web-vitals` library and emit them as span
events yourself. That works, but it is hand-rolled, and it is the piece most likely to churn within
12 months.

Mitigation: keep the RUM layer behind a thin internal interface so the underlying browser SDK can be
swapped without touching call sites, and treat the vendor's own distribution as a supported
alternative rather than betting on upstream GA timing.

---

## 5. Cost analysis

### MVP — effectively zero

| Item | Choice | Cost |
|---|---|---|
| Frontend deploy | Existing deployment, separate URL | $0 incremental |
| Trace/RUM backend | Grafana Cloud Free — 50 GB traces, 14-day retention, 3 users | **$0** |
| OTel collector | None. Export OTLP direct from the app | $0 |
| Watchdog scheduler | GitHub Actions cron *(one reference scheduler; a plain cron or any CI works)* | $0 *(see below)* |
| LQIP generation | Existing `/dA` (`/24w/30q` = 494 B) | $0 |

**Total MVP opex: $0/month.** The one trap is GitHub-specific, not universal: GitHub Actions on a
private repo gives 2,000 min/month.
A 2-minute check every 30 minutes is 2,880 min/month and **exceeds it**. Run every 2 hours (720
min/month) or use Checkly's Hobby tier (10 uptime + 1,000 browser checks, free).

No collector is needed at MVP scale, and skipping it removes the only piece that would have required
running a service. This is the single biggest reason the MVP is cheap.

### Production, BYO model (the recommended default)

Customer-owned backends, so dotCMS carries no infrastructure cost. Their spend, roughly:

- **Traces/RUM** — the cost driver is RUM volume, not server spans. Grafana Cloud Pro is ~$6.50 per
  1k active series plus trace ingest; Honeycomb free covers 20M events/month before paid tiers. A
  mid-traffic newsletter site sampled at 10% head sampling lands comfortably in low tens of dollars
  per month; unsampled RUM on a high-traffic site does not.
- **Synthetics** — Checkly Team is $64/month for all global locations; a self-hosted Playwright
  runner is free but someone owns it.

**Sampling is not an optimisation, it is a requirement.** Ship a default head-sampling rate and make
it configurable, or the first enterprise customer gets a surprise bill and the offering acquires a
reputation.

### Production, managed tier (if dotCMS ever hosts it)

This is where the economics change completely. Running multi-tenant trace ingest means: collector
fleet, trace storage and retention policy, tenant isolation, **PII scrubbing in RUM** (URLs, user
agents, and referrers routinely carry personal data), EU data residency for GDPR customers, uptime
commitments, and on-call. Realistically **0.5–1 FTE ongoing plus infrastructure** — not a side
project, and not something the 2-week MVP can validate.

The gap between "$0 BYO" and "an FTE managed" is the most important number in this study, and it is
what makes the hybrid model correct: ship BYO now, price the managed tier only once demand is proven.

---

## 6. Pros and cons

### For

- **The category is thin, and converging on our shape.** Contentful ships *Enterprise Observability*
  (Content Delivery API logs streamed to S3/GCS/Azure for routing into Datadog, Splunk or Grafana) and
  Sanity ships Content Source Maps — but nobody ships frontend operational tooling, and nobody ships
  browser RUM. Contentful independently landed on *export into the customer's own stack*, which is the
  model this suite should follow. (An earlier draft of this study claimed the category was empty; that
  was wrong.)
- **It addresses how headless projects actually fail** — wiring, assets, caching, drift — not the
  content-modelling problems the platform already solves well.
- **Demonstrated, not asserted.** Two live defects found by measurement in the reference project.
- **OTel is vendor-neutral**, which defuses the standard "I already have Datadog" objection. That was
  the right call and it should be stated prominently in any customer material.
- **Mostly frontend code**, so it is portable across dotCMS versions and does not depend on core
  roadmap.
- **Cheap to prove.** $0 MVP, four of five pillars need no infrastructure.
- **It sets a standard** the organisation currently lacks, which is the stated charter.

### Against

- **Support surface is the real cost.** Shipping observability code into customer frontends means
  owning breakage in their builds, on their Node versions, behind their proxies. This is the
  cost that does not appear in any effort estimate and is the most common way initiatives like this
  become net-negative.
- **Browser OTel will churn.** The Browser SDK is not GA. Expect at least one breaking migration.
- **SDK churn underneath.** 285 releases in 20 months with two versioning-scheme changes. Anything
  coupled to SDK internals rots; couple only to its public surface.
- **Attribution cuts both ways.** Good RUM will prove, with data, that some slowness is dotCMS core.
  The bundle cannot fix that, and it converts vague dissatisfaction into specific, evidenced tickets
  against core. Engineering leadership should agree to that trade *before* launch, not after.
- **Scope drift into APM.** Customers who get traces will ask for alerting, SLOs, dashboards, and
  anomaly detection. Each is reasonable; together they are a product with a roadmap and a support
  org. The boundary needs to be written down on day one.
- **PS margin erosion.** An accelerator that gets customised on every engagement is not an
  accelerator. Config-driven, not fork-driven.
- **Free-tier cliff.** The demo runs at $0; real customers see real bills. Pre-empt it with published
  sampling defaults and a cost worksheet, or sales will meet it cold.
- **The read-only ceiling.** The MVP cannot demonstrate anything server-side in dotCMS. Anyone
  expecting end-to-end browser→core traces from this demo will be disappointed unless expectations
  are set explicitly.

### Honest summary of the trade
The engineering is tractable and cheap. The cost is a **permanent support and maintenance obligation
on code that runs inside customer frontends**, in an ecosystem whose upstream churns fast. That is
worth taking on if the output becomes the default standard for every headless build — amortised
across all projects. It is a poor trade if it becomes an occasionally-sold add-on maintained by
whoever last touched it.

---

## 7. Recommended pruning

Answering the standing invitation to challenge scope, with technical reasons:

1. **Drop AVIF** from P4. Measured 27% regression; quality-tuned AVIF unreachable via the filter
   ordering. Revisit when dotCMS exposes AVIF quality control.
2. **Merge P3 into P2** as a second runner over one shared assertion library. Saves ~1 day and
   prevents the two from drifting apart.
3. **Rename P1's server half** from "dotCMS server tracing" to something like "dotCMS call tracing",
   so the deliverable is not read as instrumenting the Java core.
4. **Add to P4** what was not on the whiteboard but matters most: the `no-cache` fix and `Accept`
   forwarding. These are worth more measured performance than LQIP and art direction combined.

Nothing else in the suite should be cut. The four remaining pillars each cover a distinct failure
mode and the bundle loses coherence if any is removed.

---

## 8. Packaging recommendation

The question was left open for this study. Recommendation, in order:

**1. Internal reference architecture first.** Make it the default quality bar for every headless
build. This matches the stated charter, amortises maintenance across all projects, and requires no
pricing, no SLA, and no support org to start.

**2. A Professional Services accelerator second.** PS is who implements these engagements. A
config-driven accelerator shortens delivery and is billable as part of the engagement without
becoming a separately supported product.

**3. A productised SKU only if adoption proves demand.** A sold product implies versioning, upgrade
paths, support SLAs, multi-tenant hardening, and the managed-tier FTE. None of that is validated by a
2-week MVP against a read-only instance, and committing to it now would be pricing a product whose
support cost is still unknown.

This sequencing lets the same code base graduate rather than forcing an irreversible commercial
decision up front — and each stage produces the evidence needed to justify the next.

---

## 9. Verdict

**Build the MVP.** Sequence P2 → P4 → P5 → P1 → P3, ship the high-certainty pillars first, and
timebox P1 hard so that a difficult week there still leaves four working pillars to demonstrate.

**Do not commit to a productised SKU or a managed tier** on the strength of this MVP. Both need
evidence the MVP cannot produce.

---

## 10. Decisions taken, and what remains open

Recorded 2026-09-09 by the initiative owner. Seven of the eight questions this study raised are
settled; one is deliberately reserved for the Staff Platform Engineer.

| Question | Decision |
|---|---|
| **Support model** for code we leave in the client's repo | **Lift-and-shift.** The client owns the frontend post-handover — defects are theirs to fix, raised as a support ticket, or covered by a separate annual PS subscription. Applies identically to `instrumentation.ts`, the Node SDK, the `/dA` proxy changes and the preflight endpoint. |
| **Attribution** — evidencing core latency | **Not material.** Most perceived core slowness traces to under-provisioned hosting of the client's own dotCMS container, which *is* actionable by them. A genuine core issue warrants a ticket. With browser RUM cut, attribution data is thin anyway. |
| **Head sampling** default | **Ship a sensible default; do not gate on it.** The concern was sized for RUM volume. Server spans run 3–8 per request, so 100k requests/month stays comfortably inside Grafana's free 50 GB tier. No longer a surprise-bill risk. |
| **PII** in telemetry | **URLs carry public data only** (`/{issueSlug}/{articleSlug}`). One exception: `/search?q=` carries user-typed text, so the `q` parameter is stripped before it reaches span attributes. No legal review required. |
| **Version support matrix** | **The versions present at handover.** Deprecations have not been an issue and over-anticipating them is its own cost. This *sharpens* Preflight's version check — it exists to catch the client upgrading dotCMS while the pinned frontend stays put, which is the scenario that actually occurs. |
| **OTel dependency** in the client's build | **Acceptable and disclosed.** Observability is a stated part of the VIP plan and clients may opt out. Note the scope precisely: **OTel server-side only**; the browser half is delegated to whatever RUM the client already runs. |
| **Multisite partitioning** | **Partition by `siteId`, with include/exclude lists.** Traces and synthetic checks are tagged per site, and configuration selects which sites participate — for dotCMS's reasons or the client's. |

### Still open — for the Staff Platform Engineer

**Where does the suite stop relative to alerting, SLOs and dashboards?**

Customers who get traces will ask for all three. Each is reasonable on its own; together they are a
product with a roadmap and a support organisation behind it. This boundary needs to be written down
before the first customer asks rather than after, and it is the one question this study should not
answer alone.
