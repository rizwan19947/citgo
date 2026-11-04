# Decisions

What we decided, and why. Don't reopen a decision without new evidence.

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
  month. Lighthouse lab tests (P5) are more reliable.
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

**D4 — Local first; any host and CI later.** For the MVP, the tools run on a developer's machine.
Connecting them to CI/CD (pipelines, schedules) comes after the MVP is approved, and must then work
with any host and any CI. We ship a command-line tool and code, not a hosted service. Nothing
Vercel-specific. Where hosts differ (CDN caching, say), the docs say so.

**D5 — Small scope, small changes.** Build only what's needed, not what we could. New code goes in
`vip/`. Edits to existing files stay small and are listed in the plan. New features are off by
default; bug fixes are on.

**D6 — Server-rendered projects only.** Every page is built fresh on each request, with no page
caching and no periodic rebuilds. Projects that build static pages ahead of time (SSG) are out of
scope.

## How the doctor and watchdog work

**D7 — Doctor and watchdog share one set of checks.** One tool, two commands. The doctor checks
settings and dotCMS before deploy; the watchdog checks dotCMS and a running site (by hand for now).
Each check lists the commands that run it, so a check both need is written once and the two can't
disagree. Checks get their settings passed in. On 2026-11-04 the image-proxy checks moved from the
doctor's `--base-url` to the watchdog, so each command has one job.

**D8 — The doctor runs before deploy, not inside the live site.** A health-check web page was
built once and removed the same day.
- Each visit to it made 9 calls to dotCMS. Pointing an uptime monitor at it — an easy mistake —
  would mean about 13,000 dotCMS calls a day. A password doesn't stop a teammate's mistake.
- Each client would want it secured differently, and clients own the code after handover (D14).
- The rate limit wasn't the problem; it has plenty of room.

Trade-off: the doctor checks the settings where it runs, not the live site's. A client who needs
that can run the doctor inside their own deployment. The watchdog also checks the live site from
outside.

**D9 — The doctor installs nothing.** It runs on plain Node with no packages, not even the dotCMS
SDK, so it runs anywhere.

Trade-off: the doctor never loads a page through dotCMS's page API. A problem that only affects
page loading (a permission issue, a missing home page, or a dotCMS upgrade that changes the page
API) won't be caught before deploy. None of our past problems were like that, and the watchdog's
page checks cover it.

**D10 — Build order: doctor → watchdog → image fixes → speed checks.**
- The watchdog reuses the doctor's checks, and catches pages that silently 404 (F5) early.
- Speed budgets should be set after the image fixes, not before.
- The doctor goes first: everything else depends on correct setup.

**D16 — The watchdog checks the newest items, not all of them.** Each run checks the
`WATCHDOG_LATEST` most recently changed items of the detail type (default 5), and the images they
use. Setting the number at or above the total checks everything; there's no separate full-check
mode.
- Loading every item doesn't scale. Each article page makes 5 dotCMS calls, so checking 3 sites of
  3,000 articles would take about 45,000 calls and, at about 4 seconds a page (measured on a
  dev server, 2026-11-04), roughly 10 hours. The default takes about 40 requests per site and
  about 30 seconds.
- A long run gives unclear results: because of F5, a brief dotCMS hiccup looks the same as a
  broken page.
- New and recently edited content is where new errors appear. Clients publish at different rates,
  so the number is theirs to set.

## Images

**D11 — Images: WebP only, and no browser caching for now.**
- AVIF came out 27% bigger than WebP, and dotCMS can't tune its quality. Revisit if dotCMS adds
  quality control for it.
- Serving each browser a different format gains nothing. dotCMS ignores what the browser asks for,
  every current browser supports WebP, and many CDNs cache such responses badly.
- No browser caching: clients will eventually put a CDN in front, and caching strategies differ
  from client to client. Telling browsers to cache this many images makes little sense yet. So the
  image proxy keeps passing on dotCMS's "don't cache", and caching is each client's CDN decision.

## Sites and versions

**D12 — Every result names its site.** The doctor checks every configured site. The watchdog
checks one site per run; to leave a site out, don't run it for that site. (This replaced the old
include/exclude lists.)

**D13 — We support the versions present at handover.** The doctor and the watchdog warn when the
client upgrades dotCMS but the website's SDK stays behind. Once an upgrade is tested, the baseline
(`vip/baseline.json`) moves to it: dotCMS 26.10.13-01 passed the watchdog on 2026-11-04. We don't
plan for future versions in advance.

## Business

**D14 — The client owns the code after handover.** Fixes are theirs, through a support ticket or a
paid support plan. This covers everything we add.

**D15 — First, our own reference for future headless projects.** The tools are client-agnostic:
CITGO is where they're tested, not what they're built for, so project details come from a few env
settings and from dotCMS itself, not from code. After that comes a Professional Services package,
and a sold product only if demand proves it. Reasoning in the
[business case](./04-business-case.md#packaging).

## Out of scope

- Changing anything in the client's dotCMS.
- Any monitoring: tracing (D3), browser monitoring (D2), alerts, dashboards, uptime targets. Where
  the suite should stop on alerts and dashboards was an open question; it returns with P1.
- Connecting the tools to CI/CD, until the MVP is approved (D4).
- SEO extras: sitemap, structured data, configurable page titles (D5).
- Static-site (SSG) projects, and changes to how pages render (D6).
- AVIF, per-browser image formats, and browser image caching (D11).
- Hosting anything for clients.
- Fixing drafts that leak onto the site. Detecting them is a parked idea in the plan.
