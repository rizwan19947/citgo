# Decisions

What we decided, and why. Don't reopen a decision without new evidence. Open questions are at the
end.

## Scope

**D1 — Website only.** We work on the website code. dotCMS itself, its servers and its admin
screens belong to the dotCMS product team.

**D2 — No browser monitoring.** Nothing that runs in visitors' browsers: no real-user monitoring
(RUM), no page-speed beacon. We won't build it or ship sample code for it.
- Our target clients already pay for this (Datadog, New Relic, Dynatrace).
- EU privacy rules (ePrivacy) require proper cookie consent for it. This site's cookie banner
  (`components/CookieBanner.tsx`) is only an "OK" notice, and data from consenting visitors alone
  is skewed anyway.
- These sites get too little traffic for Google's visitor data, which needs roughly 10–15k views a
  month. Lab tests in CI (P5) are more reliable.
- The browser tooling is still unfinished and would keep changing.

Trade-off: a client with no monitoring of their own gets no visitor data from us; Lighthouse lab
data is the substitute.

**D3 — No tracing for now.** P1 (dotCMS call tracing, with OpenTelemetry) is deferred: no tracing
code, packages, settings or services in this phase. Bringing it back needs a new decision. Notes
for that day:
- It would time only the website's own calls to dotCMS. dotCMS itself emits nothing to trace, and
  we can't change it.
- It would send data straight to the client's own monitoring tool: no extra services, no special
  access, nothing listening for requests.
- Next.js already records request and fetch timings once tracing is on. Adding OpenTelemetry's
  http or undici plugins would double them (`NEXT_OTEL_FETCH_DISABLED=1` turns Next's off).
- Time each dotCMS call inside its error handling, or silent failures (F5) look like successes.
- Give it its own on/off flag; some servers set OpenTelemetry settings for other tools.
- At 3–8 records per page, default sampling is fine.
- Strip what users type into search from anything recorded.
- Server timings can't show cache hits: those never reach the server.
- When dotCMS looks slow, the cause is usually the client's own hosting.

**D4 — Any host, any CI.** We ship a command-line tool and code, not a hosted service. CI and
scheduler files are examples. Nothing Vercel-specific. Where hosts differ (CDN caching, say), the
docs say so.

**D5 — Small changes.** New code goes in `vip/`, except files Next needs elsewhere
(`app/sitemap.ts`) and CI examples. Edits to existing files stay small and are listed in the plan.
New features are off by default (the sitemap and structured data use the existing `SITE_INDEXING`
switch). Bug fixes are on.

**D6 — Pages render the same way.** Every page is still built fresh on each request. No page
caching and no periodic rebuilds.

## How the doctor works

**D7 — Doctor and watchdog share one set of checks.** One tool, run two ways: before deploy (the
doctor) and on a schedule against the live site (the watchdog). Checks get their settings passed
in, so the same check works in both places and the two can't disagree.

**D8 — The doctor runs before deploy, not inside the live site.** A health-check web page was
built once and removed the same day.
- Each visit to it made 9 calls to dotCMS. Pointing an uptime monitor at it — an easy mistake —
  would mean about 13,000 dotCMS calls a day. A password doesn't stop a teammate's mistake.
- Each client would want it secured differently, and clients own the code after handover (D14).
- The rate limit wasn't the problem; it has plenty of room.

Trade-off: the doctor checks the settings CI has, not the live site's. A client who needs that can
run the doctor inside their own deployment. The watchdog also checks the live site from outside.

**D9 — The doctor installs nothing.** It runs on plain Node with no packages, not even the dotCMS
SDK, so it runs anywhere.

Trade-off: the doctor never loads a page through dotCMS's page API. A problem that only affects
page loading (a permission issue, a missing home page, or a dotCMS upgrade that changes the page
API) won't be caught before deploy. None of our past problems were like that, and the watchdog's
page checks cover it later.

**D10 — Build order: doctor → image fixes → SEO and speed → watchdog.**
- The watchdog reuses the doctor's checks.
- Speed budgets should be set after the image fixes, not before.
- The doctor goes first: everything else depends on correct setup.

Whether the watchdog's content checks move earlier is Q4.

## Images

**D11 — Images stay WebP. No AVIF, no per-browser formats.**
- AVIF came out 27% bigger than WebP, and dotCMS can't tune its quality.
- Serving each browser a different format gains nothing. dotCMS ignores what the browser asks for,
  every current browser supports WebP, and many CDNs cache such responses badly, which would undo
  the caching fix.

Revisit AVIF if dotCMS adds quality control for it.

## Sites and versions

**D12 — Every result names its site.** The doctor checks every configured site. The watchdog
checks one site per run; to leave a site out, don't schedule it. (This replaced the old
include/exclude lists.)

**D13 — We support the versions present at handover.** The doctor warns when the client upgrades
dotCMS but the website's SDK stays behind. We don't plan for future versions in advance.

## Business

**D14 — The client owns the code after handover.** Fixes are theirs, through a support ticket or a
paid support plan. This covers everything we add.

**D15 — An internal standard first, not a product.** First our default for every headless project,
then a Professional Services package, and a sold product only if demand proves it. Reasoning in the
[business case](./04-business-case.md#packaging).

## Out of scope

- Changing anything in the client's dotCMS.
- Any monitoring: tracing (D3), browser monitoring (D2), alerts, dashboards, uptime targets. Where
  the suite should stop on alerts and dashboards was an open question; it returns with P1.
- AVIF and per-browser image formats (D11).
- Hosting anything for clients.
- Fixing drafts that leak onto the site. Detecting them is a parked idea in the plan.
- Changing how pages render (D6).

## Open questions

**Q1 — How does CITGO's own deployment build its pages?**
CITGO runs their own copy on Windows/IIS, where about 50–60 articles returned 404 in September
([details](./02-evidence.md#citgos-own-deployment)). We don't know how that ended.
- Why it matters: if they build pages ahead of time, the watchdog's article check (Q4) matters
  most. It also affects where the watchdog can run (Q5).
- Recommendation: find out before Stage 4.

**Q2 — Is the next milestone for CITGO, or for our own reference?**
- Why it matters: these sites are deliberately hidden from search engines, so for CITGO a sitemap,
  structured data and configurable page titles would be unused code.
- Recommendation: for CITGO, skip all three. For our own reference, build them, switched off by
  default.

**Q3 — How long should browsers cache images?**
Replacing an image in dotCMS keeps its address (F1). With a one-year cache, visitors could see the
old image for a year, with no way to clear it.
- Recommendation: cache for a day, then refresh quietly in the background for up to a week
  (`public, max-age=86400, stale-while-revalidate=604800`).
- Alternative: a new address for every image version, cached forever. More work, and old addresses
  can stop working after an update.
- Needed from the client: do they use a CDN, can they clear it, and do editors replace images or
  upload new ones?

**Q4 — Should the watchdog check every article, and be built right after Stage 1b?**
- Why: it would catch missing articles like CITGO's (F5), however their site is built.
- Recommendation: yes to both. The scheduler examples stay last.

**Q5 — Where can the watchdog run for CITGO?**
Their test site is only reachable inside their network.
- Recommendation: run it on a machine inside their network, or skip scheduled checks for them.
