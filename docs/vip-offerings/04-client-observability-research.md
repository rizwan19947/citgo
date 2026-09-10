# What Headless Clients Actually Want From Observability

Research memo, 2026-09-09. Commissioned to test one question: **is OTel browser RUM worth its
uncertainty, or are we about to over-engineer something no enterprise will use?**

**Answer: drop browser RUM from the MVP.** Not because it is hard — because the clients already own
it, the market does not ship it, and two independent constraints make our version worse than theirs.
Everything else in P1 stays, and Day 4 stops being the risk day.

---

## 1. The decisive finding

You said almost all target enterprises already run Datadog, New Relic or Dynatrace. That turns out to
settle the question, because of a fact I did not know before this research:

> **Datadog's RUM SDKs already inject W3C `traceparent` into frontend network requests, and Datadog's
> RUM UI already displays backend traces from OTel-instrumented applications.**

The same is true across the field — by 2026 every serious APM vendor (Datadog, New Relic, Dynatrace,
Splunk, Elastic, Honeycomb, Instana) accepts OTLP as a first-class ingest format, and New Relic
treats OTel as a native data source.

So for a client already running RUM:

```
their RUM SDK (browser)  ──traceparent──▶  our OTel server spans  ──▶  their backend
        ▲                                            │
        └──────── already correlated in their UI ◀───┘
```

**We do not need to build the browser half. We need our server half to speak W3C trace context** —
which OTel's Node SDK does by default, since `W3CTraceContextPropagator` is the default global
propagator. Inbound `traceparent` on a request is extracted automatically.

The work that delivers this is *already in the plan* (Day 3, server spans + dotCMS call spans). The
browser half we scoped for Day 4 duplicates a product the client has already bought, worse.

## 2. What the market actually ships

I claimed in the feasibility study that "the category is empty." **That was wrong, and it is the kind
of error the Staff Engineer review would have caught.** Correcting it:

| Vendor | What they ship | Shape |
|---|---|---|
| **Contentful** | *Enterprise Observability* — streams Content Delivery API and GraphQL logs (request time, response status, cache behaviour, latency) to S3 / GCS / Azure Blob, for routing into Datadog, Splunk or Grafana | Server-side delivery logs → **the customer's own stack** |
| **Sanity** | *Content Source Maps* + stega encoding — traces rendered UI back to the exact source field | Content provenance, not performance |
| **Contentstack** | Nothing found | — |
| **Anyone** | Browser RUM | **Nobody** |

The corrected competitive read is more useful than the wrong one. The category is not empty — it is
**converging on one shape: give the customer their delivery-layer data, in the stack they already
run.** Contentful does not build dashboards; it builds an export. Nobody builds RUM, because
customers already have it.

That is a strong signal that the export-and-integrate model is right and the build-our-own-RUM model
is the outlier.

## 3. What enterprise CMS teams say they need

From the enterprise CMS observability literature, the recurring asks are:

- **Read latency and throughput** on the content delivery API
- **Cache hit ratios** across CDN layers
- **Broken link and asset counts** in rendered content
- **Preview error rates**, treated as an SLO that gates releases
- **Correlation IDs** so engineers can pivot from a symptom to a request
- Role-segmented views — *"engineers need APM integration and correlation IDs, while editors and
  marketers benefit from click-to-edit previews"*

Mapped against the suite:

| Ask | Covered by | Status |
|---|---|---|
| Content API latency / throughput | P1 dotCMS call spans | ✅ planned |
| Cache hit ratio | P4 caching fix + P1 span attributes | ✅ planned |
| Broken assets in rendered content | P3 watchdog | ✅ planned |
| Correlation IDs | P1 server spans (W3C context) | ✅ planned |
| Preview error rates as SLO | — | ❌ not in scope |
| Content source maps / click-to-edit | UVE partially covers this | ~ |
| **Browser RUM** | — | **nobody asked for it** |

Every stated need is already covered by the server-side and content-layer work. RUM appears nowhere
on the list.

## 4. The three audiences, and what each actually wants

You named three consumers. None of them wants us to build RUM.

**Client platform / SRE.** Wants OTLP into the stack they already operate, with correlation IDs. A
second RUM tool is a liability to them — another agent, another vendor review, another bill. What
they want from us is that our spans *join* their traces.

**Client frontend developers.** Wants Core Web Vitals and regressions caught before release. That is
a **synthetic/CI** need, and Lighthouse CI in P5 covers it. RUM tells you a regression already shipped;
CI stops it shipping.

**Client marketing / content.** Wants "did my content publish, is anything broken, are pages fast."
A tracing UI is actively wrong for this audience. The watchdog plus a simple scorecard is the fit.

## 5. Two constraints that make our RUM worse than theirs

**Consent.** RUM that sets a session identifier requires consent under the ePrivacy Directive —
Datadog RUM's session cookie does, and most EU DPAs treat persistent-identifier beacons as
consent-gated. Cookieless designs can sometimes rest on legitimate interest, provided there is no
profiling and retention is short.

This has a concrete consequence in *this* codebase: `components/CookieBanner.tsx` is an
**acknowledgement** banner. One "OK" button, a `localStorage` flag, no categories, no gating, and
nothing consuming the result. Shipping RUM behind proper consent would mean rebuilding it into a real
consent manager — work that is not in any estimate. And consent-gated RUM yields a **biased partial
sample**, which is a poor foundation for performance decisions.

**CrUX will not fill the gap either.** Google's Chrome UX Report needs roughly 10–15k views/month
before it publishes data, and low-traffic origins get origin-level only, or nothing. Corporate
newsletter sites are plausibly below that line.

Those two together produce a genuinely useful conclusion: **for low-traffic enterprise sites,
synthetic monitoring is a more reliable performance signal than RUM.** RUM's sample is consent-gated
*and* thin; a Lighthouse run is neither.

## 6. Recommendation

**Cut browser RUM from the MVP.** Replace it with three things, all cheaper:

1. **Accept inbound `traceparent`** on the server so whatever RUM the client already runs correlates
   with our dotCMS call spans. Default OTel behaviour — verify it, do not build it.
2. **Lighthouse CI as the performance signal** (already P5). Add a Core Web Vitals scorecard view for
   the marketing/content audience.
3. **Document "bring your own RUM"** as the integration story, with a worked example for Datadog and
   New Relic.

**Keep in reserve, do not build:** the `web-vitals` beacon, for the minority of clients with no RUM
at all. Roughly two hours if a client needs it. Ship it as documented sample code rather than as part
of the product.

### What this changes in the plan

| | Before | After |
|---|---|---|
| Day 4 | Browser RUM + `traceparent` correlation — the risk day | Verify inbound trace context, build the dashboard, CWV scorecard — ~half a day |
| Freed | — | ~1.5 days for preview-error SLOs, or slack against the crunch |
| Risk profile | One pre-GA dependency on the critical path | None |

### What we lose

Nothing a client with existing RUM is not already getting — better — from their own vendor. For a
client with no RUM, we lose turnkey vitals, mitigated by the documented beacon.

### What to put to the Staff Engineer

The framing shifts from *"should we build RUM?"* to *"our differentiator is the dotCMS-aware signals
nobody else can produce — call latency, rate-limit consumption, asset resolution, content-layer
health — delivered into the stack the client already runs."* That is defensible, matches where
Contentful landed independently, and carries none of the pre-GA risk.

## Sources

- [Correlate Datadog RUM events with OTel traces](https://www.datadoghq.com/blog/correlate-traces-datadog-rum-otel/) · [Datadog RUM/OTel correlation docs](https://docs.datadoghq.com/opentelemetry/correlate/rum_and_traces/)
- [Contentful Enterprise Observability](https://www.contentful.com/developers/docs/concepts/enterprise-observability/) · [announcement](https://www.contentful.com/blog/contentful-enterprise-observability/)
- [Monitoring and observability for Enterprise CMS](https://www.enterprisecms.org/guides/monitoring-and-observability-for-enterprise-cms)
- [Datadog GDPR / RUM consent guide](https://www.flowconsent.com/en/services/other/datadog) · [Cloudflare cookieless RUM and consent](https://www.flowconsent.com/en/services/analytics/cloudflare-browser-insights)
- [CrUX methodology](https://developer.chrome.com/docs/crux/methodology) · [CrUX eligibility thresholds](https://www.debugbear.com/blog/chrome-user-experience-report)
- [OpenTelemetry status page](https://opentelemetry.io/status/) · [Sanity Content Source Maps](https://www.sanity.io/sanity-vs-contentstack)
