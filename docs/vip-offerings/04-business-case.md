# Business Case

Should we build the VIP suite, and how should it be offered? **Yes — as an internal reference
architecture first** (D14), with the rescopes applied: observability deferred (D2, D3), AVIF
dropped, P3 merged into P2. The engineering is low-risk. The real cost is long-term support — a
packaging question, not an engineering one.

## Why this exists

- **dotCMS is a hybrid CMS.** Its headless surface inherits page-era assumptions — URL maps,
  container layouts, the `/dA` pipeline — that leak into frontend code in ways an API-first CMS
  wouldn't.
- **The SDK churns.** 328 releases since January 2024 and two changes of versioning scheme. SDK/core
  drift is a structural failure mode, not a one-off mistake.
- **Headless projects fail at the seams** — wiring, assets, caching, drift — not in content
  modelling, which the platform already does well.
- **Proof from our own project.** Built by a competent team and handed off, it still had defects
  nobody saw: images never cached (F1), image quality inverted (F2), unvalidated SDK drift (F3), a
  lazy-loaded hero image (F4), and silent fetch failures (F5). None surfaced in tests, review or a
  default Lighthouse run.
- **Multisite matters commercially.** dotCMS comes as Cloud (SaaS), Enterprise (on-prem) and
  Community (GPL-3.0), licensed per JVM with no seat or site limits. Multisite is cheap to sell, so
  a solid multisite frontend story is worth having.

## How the pillars fit

```
Preflight (P2) ──validates──▶ dotCMS SDK ──▶ /dA proxy ──▶ image loader
      │                           │                └────┬─────┘
      │                           │             Image pipeline (P4)
      │                           ▼             (what flows through)
      └──same checks──▶ Watchdog (P3)           SEO & perf baseline (P5)
                     (keeps it working)         (what the output must meet)
```

P2 proves the wiring once; P3 proves it stays right; P4 and P5 govern the quality of what flows
through. The bundle's claim — performant, reliable, correctly wired — holds because each pillar
covers a different failure mode of the same pipeline. With observability deferred (D3), nothing
measures the running site from inside; P3 checks it from outside, on a schedule.

## What customers ask for

From enterprise CMS observability guidance, mapped to the suite:

| Ask | Covered by |
|---|---|
| Content API read latency and throughput | Not covered — observability is deferred (D3) |
| Correlation IDs, to go from a symptom to a request | Not covered — observability is deferred (D3) |
| Broken links and assets in rendered content | P3 |
| Cache behaviour | P4 fixes the caching. Measuring hit ratios needs CDN logs or synthetic tests |
| Preview error rates as a release-gating SLO | Not covered — out of scope |
| Click-to-edit for editors | Partly, through UVE |

Three audiences:
- **Client platform / SRE teams** want gates that fit their existing pipelines → P2 in any CI.
  Telemetry in their own stack waits on P1 (D3).
- **Client frontend developers** want regressions caught before release → P2 in CI, Lighthouse CI
  (P5).
- **Client marketing and content teams** want to know "did it publish, is anything broken, is it
  fast?" → P3 plus a simple Lighthouse scorecard.

**Positioning:** dotCMS-aware checks nobody else ships — wiring correctness, SDK/core drift, asset
resolution, content health — runnable in any CI, with no new infrastructure.

## Market

Checked 2026-09-09.

| Vendor | Ships | Shape |
|---|---|---|
| Contentful | Enterprise Observability: Content Delivery and GraphQL API logs streamed to S3, GCS or Azure Blob, for Datadog, Splunk or Grafana | Export into the customer's stack |
| Sanity | Content Source Maps and stega encoding: rendered UI traced back to source fields | Content provenance |
| Contentstack | Nothing found | — |
| Anyone | A wiring validator, or a content-aware asset watchdog | Nobody |

- dotCMS is **behind** Contentful on delivery telemetry, and with P1 deferred the suite ships none.
  Don't pitch it as category-defining.
- If telemetry comes back, Contentful's model — export into the customer's own stack — is the one
  to follow. It would sit between "CMS vendor" and "APM vendor", where customers already own the
  relationship.

## Effort

About 4–6 days remain; per-stage estimates and certainty are in the [plan](./03-plan.md#status).
The first estimate was 8.5–11 days. Removing everything browser-side (D2) took out the largest
estimate and the only dependency on a pre-GA SDK; deferring P1 (D3) removed another 1.5–2 days and
the only new runtime dependency.

## Cost

**MVP: $0 a month.**

| Item | Choice | Cost |
|---|---|---|
| Frontend | The existing deployment | $0 |
| Infrastructure | None — the suite is a CLI plus code changes | $0 |
| Scheduler | GitHub Actions cron (one example; any cron works) | $0 within limits |
| LQIP source | The existing `/dA` endpoint (`/24w/30q`) | $0 |

A GitHub-only trap: private repos get 2,000 Actions minutes a month. A 2-minute check every 30
minutes uses 2,880. Run every 2 hours (720 minutes), or use Checkly's free Hobby tier (10 uptime and
1,000 browser checks).

**In production,** customers run the CLI in their own CI or cron, and dotCMS carries no
infrastructure cost. For hosted synthetic checks, Checkly Team is $64 a month for all locations; a
self-hosted Playwright runner is free, but someone has to own it.

**Managed tier: not planned.** If dotCMS ever hosted telemetry for customers — only relevant if P1
returns — multi-tenant ingest would need a collector fleet, storage and a retention policy, tenant
isolation, PII scrubbing, EU data residency, uptime commitments and on-call: realistically
**0.5–1 FTE plus infrastructure**. Ship bring-your-own; price a managed tier only once demand is
proven.

## Risks and trade-offs

For:
- The category is thin: nobody ships a wiring validator or a content-aware asset watchdog.
- It targets how headless projects actually fail.
- Demonstrated, not asserted — see the defects above.
- It's mostly frontend code: portable across dotCMS versions, independent of the core roadmap.
- It's cheap to prove: a $0 MVP with no new infrastructure.
- It sets a standard the organisation currently lacks — the stated charter.

Against:
- **Support is the real cost.** Code inside customer frontends means owning breakage in their
  builds, on their Node versions, behind their proxies. It appears in no estimate, and it's the
  usual way initiatives like this turn net-negative. Lift-and-shift (D13) limits it.
- **The SDK churns underneath.** Anything coupled to SDK internals rots, so couple only to its
  public surface.
- **Scope drift.** Watchdog results invite requests for alerting and dashboards. Those are out with
  the rest of observability (D3); say so up front.
- **PS margin erosion.** An accelerator that's customised on every engagement isn't an accelerator.
  Keep it config-driven, not fork-driven.
- **The read-only ceiling.** The MVP can't show anything inside dotCMS. Set that expectation up
  front.

The trade: the engineering is cheap. The cost is a permanent support obligation on code that runs
inside customer frontends, on a fast-moving upstream. It's worth it if this becomes the default for
every headless build, so the cost is shared. It's a poor trade as an occasional add-on maintained by
whoever last touched it.

## Packaging

1. **Internal reference architecture first.** The default quality bar for every headless build. It
   matches the charter, spreads maintenance across projects, and needs no pricing, SLA or support
   org.
2. **Professional Services accelerator second.** PS implements these engagements. A config-driven
   accelerator shortens delivery and bills as part of the engagement, without becoming a separately
   supported product.
3. **Product SKU only if adoption proves demand.** A sold product needs versioning, upgrade paths,
   support SLAs and multi-tenant hardening. A small MVP against a read-only instance validates none
   of that.

Each stage produces the evidence that justifies the next, so the same code can graduate without an
irreversible commercial decision up front.

## Pitch framing

- F1–F5 are defects in **our own** reference project. "Look what we found in a client build" is
  accurate but cuts both ways. Present them as *why we built the tooling*: the team that wrote this
  code couldn't see them without it.
- Don't count F7 (the proxy's `Accept` and `Vary` handling); it has no effect today.
- Close the demo on this: every finding was invisible in a project that passed review and shipped.
- P5 is the easiest pillar to sell — SEO is a line item every enterprise buyer understands.

## Sources

- [Contentful Enterprise Observability](https://www.contentful.com/developers/docs/concepts/enterprise-observability/) ·
  [announcement](https://www.contentful.com/blog/contentful-enterprise-observability/)
- [Monitoring and observability for enterprise CMS](https://www.enterprisecms.org/guides/monitoring-and-observability-for-enterprise-cms)
- [Sanity Content Source Maps](https://www.sanity.io/sanity-vs-contentstack)
- [dotCMS features — Enterprise, Cloud, Community](https://www.dotcms.com/product/features)
