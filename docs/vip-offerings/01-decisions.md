# Decisions

What's settled and what's open. **Settled** means: don't reopen without new evidence. Facts cited
here (F-numbers, measurements) are in [02-evidence](./02-evidence.md).

## Settled

### Scope

**D1 — Frontend only.** The suite covers the headless frontend. dotCMS core, its backend and the
admin panel belong to the product team.

**D2 — Nothing browser-side.** No RUM, no web-vitals beacon, no browser trace correlation — not
built, not offered as sample code. Browser RUM was cut on 2026-09-09; the remaining browser-side
work was removed on 2026-11-02. Why:
- Target enterprises already run RUM (Datadog, New Relic, Dynatrace). A second browser agent is a
  liability to their SRE teams, and no CMS vendor ships one.
- RUM that sets a session identifier needs ePrivacy consent. `components/CookieBanner.tsx` only
  acknowledges a notice (one "OK" button, a `localStorage` flag that nothing reads). It isn't a
  consent manager, and consent-gated RUM gives a biased, partial sample anyway.
- Low-traffic sites get little field data: the Chrome UX Report (CrUX) needs roughly 10–15k
  views/month before it publishes anything. Lighthouse CI (P5) is the more reliable signal here.
- Browser OpenTelemetry isn't GA and has no official web-vitals instrumentation. Ours would be
  hand-rolled and would churn.

Cost: a client with no RUM of their own gets no field data from us. Lighthouse lab data is the
substitute.

**D3 — No OpenTelemetry for now.** P1 — tracing the frontend's calls to dotCMS ("dotCMS call
tracing") — is deferred with the rest of observability (2026-11-03). This phase adds no
OpenTelemetry code, dependencies, environment variables or backend. P1 returns only by a new
decision. If it does, start from what was already settled or verified:
- **Scope:** the frontend's own dotCMS calls, never dotCMS core — core emits no OpenTelemetry and
  the instance is read-only. It would run in the client's deployment, on their credentials,
  exporting OTLP straight to their backend: no collector, no privileged access, no listening
  surface.
- **Next already traces:** Next 16 creates the request span and a span per server-side `fetch`
  (verified in the 16.2.4 source). Adding the http or undici instrumentations duplicates them;
  `NEXT_OTEL_FETCH_DISABLED=1` hides Next's fetch spans if a replacement is wanted.
- **Placement:** wrap each dotCMS fetcher inside `cache()` and inside its `try`. Outside the `try`,
  swallowed errors (F5) look like successes.
- **Config:** a dedicated opt-in flag, because hosts sometimes set `OTEL_*` variables for other
  tools; everything else through the standard `OTEL_*` variables. Default sampling (parent-based,
  always on) is fine at 3–8 spans per request.
- **PII:** strip `q` from `/search` and `/api/search` URLs, and never record the search query.
- **Limits:** a cache-hit ratio can't come from server spans, because browser and CDN hits never
  reach the server. Most perceived dotCMS slowness turns out to be the client's own hosting.

**D4 — Host- and CI-agnostic.** The deliverables are a CLI and a library. Schedulers and workflow
files are reference examples. Nothing may assume a host, CDN or CI vendor; no `VERCEL_*`. Where
behaviour genuinely differs by host — CDN caching, for one — the docs say so.

**D5 — Small, switchable changes.** New code goes under `vip/`, except files Next requires
elsewhere (`app/sitemap.ts`) and CI examples. Edits to existing files are surgical and listed per
stage in the plan. Additive features (LQIP) ship behind configuration, off by default. Defect fixes
(F1, F2, F4) ship on.

**D6 — No rendering-strategy change.** Routes stay server-rendered per request. No ISR or
revalidation.

### Architecture

**D7 — P3 reuses P2's checks.** One check library, run by one CLI in two modes: before deploy (P2)
and on a schedule against a deployed site (P3). Checks get everything from an injected
`CheckContext` and never read `process.env` themselves — that is what lets one check run locally
and remotely. Merging saved about a day and means the two can never disagree.

**D8 — No runtime endpoint.** The doctor is a pre-deploy CI gate only: `npm run doctor`, non-zero
exit on any error. A `/api/_vip/preflight` route was built on 2026-09-11 and removed the same day.
- *Why it was tempting:* env checks read the environment of whoever runs them, so a green CI run
  proves CI's config, not the deployment's. Only code inside the deployment can check its
  `FRONTEND_HOST_OVERRIDE`.
- *Why it was dropped:*
  - It ships an abusable surface into every client repo. One request fans out to 1 + 2N + 2
    dotCMS calls (9 for three sites). The realistic failure is an ops engineer pointing an uptime
    monitor at it: at one-minute intervals that's ~13,000 dotCMS requests a day, forever. A bearer
    token doesn't help — the person making the mistake is on the team.
  - Its auth, exposure and caching would be renegotiated per client: a high-churn surface to own
    under lift-and-shift (D13).
  - Not because of the rate limiter: five `_search` calls cost ~1–2 tokens of a refilling
    100,000 bucket. The objection is the fan-out and the surface.
- *Accepted limitation:* nothing checks the deployed environment's config. If a client needs that,
  run the same CLI as a release step inside the deployment — still no listening surface. P3 checks
  deployed *behaviour* from outside.

(Folders starting with `_` are private in the Next App Router, so a route under `app/api/_vip/`
can't be served anyway.)

**D9 — Build order: P2 → P4 → P5 → P3.**
- P3 reuses P2's checks.
- P5's Lighthouse budgets should measure after P4's image changes, not before.
- P2 first verifies the wiring everything else sits on.

Whether P3's content checks run earlier is Q6.

### Images

**D10 — No AVIF.** Measured: 27% larger than WebP (35,740 B vs 28,200 B), and quality-tuned AVIF
is unreachable because `/40q/avif` silently returns WebP. Revisit if dotCMS exposes AVIF quality
control.

### Sites and versions

**D11 — Multisite: partition by `siteId`.** Every watchdog result carries its site. Include and
exclude lists (`VIP_SITES`, `VIP_SITES_EXCLUDE`) decide which sites the watchdog checks — for
dotCMS's reasons or the client's. The pre-deploy doctor always checks every `SITE_N`.

**D12 — Supported versions are the ones present at handover.** Deprecations haven't been a problem,
and anticipating them has its own cost. The doctor's version check exists for the realistic case:
the client upgrades dotCMS while the frontend's SDK stays pinned.

### Commercial

**D13 — Support model: lift-and-shift.** The client owns the frontend after handover. Defects are
theirs to fix, via a support ticket, or under a separate annual PS subscription. This covers the
`/dA` proxy changes, the image and SEO changes, and the `vip/` library alike.

**D14 — Packaging: internal reference architecture → PS accelerator → product SKU only if adoption
proves demand.** Don't commit to a SKU or a managed tier on the strength of the MVP. Reasoning in
the [business case](./04-business-case.md#packaging).

## Out of scope

- Any write to the dotCMS instance — content types, fields, plugins, config.
- Observability of any kind: OpenTelemetry and tracing (D3), anything browser-side (D2), alerting,
  SLOs, dashboards, anomaly detection. Where the suite should stop relative to alerting, SLOs and
  dashboards was an open question for platform review; it comes back with P1.
- AVIF (D10).
- Multi-tenant managed hosting of any backend.
- Fixing draft/preview visibility. Detecting draft leaks is a parked idea in the plan.
- Rendering-strategy changes (D6).

## Open questions

Each has a recommendation. Tasks that depend on one are marked *(pending Qn)* in the plan.

**Q1 — How does CITGO's own deployment render pages?**
Their Windows/IIS fork had about 50–60 articles returning 404 in Sept 2026
([the client's deployment](./02-evidence.md#the-clients-deployment)). The investigation's outcome
isn't recorded.
- *Why it matters:* if their pages render at build time, P3's coverage check (Q6) matters most,
  and LQIP's per-response cost no longer applies. It also shapes where the watchdog can run (Q7).
- *Recommendation:* find out before Stage 4, the watchdog.

**Q2 — Is the next milestone for CITGO or an internal reference?**
- *Why it matters:* the sites are deliberately `noindex`, so a sitemap and JSON-LD would be dead
  code for CITGO. Moving SEO code into `vip/seo/` only pays off once a second project uses it.
- *Recommendation:* for CITGO, skip all three — the client owns the code after handover. For an
  internal reference, build them behind `SITE_INDEXING`.

**Q3 — What cache policy should `/dA` responses get?**
`/dA/{identifier}` serves the asset's current version, and replacing an image keeps its identifier
(F1). A year-long `immutable` would pin the old image in every browser that saw it, with no way to
purge.
- *Recommendation:* `public, max-age=86400, stale-while-revalidate=604800` — nearly all of the
  repeat-navigation win, with staleness bounded to about a day.
- *Alternative:* version-addressed URLs plus `immutable`. The app would need each image's inode, and
  inode URLs can return 401 once the asset is updated.
- *Needed from the client:* is there a CDN in front, can they purge it, and do editors replace
  images in place or upload new ones?

**Q4 — Build format negotiation?** That means forwarding `Accept`, choosing WebP or JPEG in the
frontend, adding `Vary: Accept`, and optionally honouring `Save-Data`.
- *Why not:* forwarding `Accept` does nothing — dotCMS ignores it (measured). WebP works in
  effectively every current browser. CDNs handle `Vary: Accept` inconsistently — some won't cache
  it, some keep a copy per `Accept` string — which would undo the caching fix.
- *Recommendation:* don't build it. Document why, as with AVIF.

**Q5 — Should the doctor call `@dotcms/client` itself?**
The app reaches dotCMS through the SDK. The doctor hand-writes different requests and never calls
the Page API (B4).
- *Recommendation:* yes. The SDK is already installed, and its `httpClient` option lets the doctor
  keep its own fetch, so `VIP_CACHE` and timings still work. It ties the doctor to the SDK version,
  which is exactly what a compatibility check should test.

**Q6 — Add a per-article coverage check to P3, and run P3's content checks right after Stage 1b?**
- *Why:* it catches the client's 404s (F5) from outside, whatever the rendering mode.
- *Recommendation:* yes to both. The scheduler examples stay last.

**Q7 — Where can the watchdog run for CITGO?**
Their staging host resolves only on internal DNS.
- *Recommendation:* a runner inside their network, or no scheduled checks for them.
