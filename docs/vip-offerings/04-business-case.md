# Business Case

## In one paragraph

Headless dotCMS sites break in ways normal testing misses: wrong settings, missing content, an SDK
that falls behind dotCMS. The VIP tools catch these problems before and after deploy. They're built
for any headless dotCMS project and tested on CITGO. We recommend making them our own reference for
future headless projects first (D15). Building them is small and low-risk; the real cost is
supporting code that lives in client projects.

## Why it's needed

- **dotCMS is a hybrid CMS.** Its headless features carry habits from its page-building side (URL
  maps, layouts, the image pipeline), and those leak into website code.
- **The SDK changes fast.** 328 releases since January 2024, and two changes of numbering scheme.
  Falling behind is a regular risk, not a one-off.
- **Headless sites fail at the joins:** settings, images, caching, versions. Not in content
  modelling, which dotCMS does well.
- **We have proof from our own project.** A well-built, handed-off site still had problems nobody
  saw: an image cache that never worked (F1), image quality backwards (F2), an outdated SDK (F3), a
  main image that loads late (F4) and silent loading failures (F5). No test, review or standard
  Lighthouse run caught them.
- **Multisite matters commercially.** dotCMS (Cloud, Enterprise or Community) is licensed per
  server, with no limit on sites. Multisite is easy to sell, so a solid multisite setup is worth
  having.

## How the parts fit

```
Doctor (P2) ──checks──▶ dotCMS SDK ──▶ image proxy ──▶ image loader
     │                       │                └──────┬──────┘
     │                       │                 Image fixes (P4)
     │                       ▼
     └──same checks──▶ Watchdog (P3)           Speed checks (P5)
```

The doctor proves the setup is right before deploy. The watchdog checks that a running site's key
pages, newest articles and their images work. The image fixes and speed checks keep pages fast.
Each part covers a different way the same pipeline can fail. With tracing deferred (D3), nothing
measures the live site from inside; the watchdog checks it from outside.

## What clients ask for

| Ask | Covered? |
|---|---|
| dotCMS response times | No: tracing is deferred (D3) |
| Request IDs, to trace a problem | No: tracing is deferred (D3) |
| Broken links and images | Partly: the watchdog (P3) checks key pages, the newest items and their images. It doesn't follow links inside pages |
| Caching | No: left to each client's CDN (D11) |
| Preview error rates as a release gate | No: out of scope |
| Click-to-edit for editors | Partly, through dotCMS's visual editor |

Who uses what:
- **Platform and operations teams:** the doctor, by hand now and in their pipelines later (D4).
  Data in their own monitoring tools waits on tracing (P1).
- **Frontend developers:** problems caught before release, by the doctor and the speed checks.
- **Marketing and content teams:** "Did it publish? Is anything broken? Is it fast?" The watchdog
  and the Lighthouse report answer that.

**Our pitch:** dotCMS-aware checks nobody else offers — setup, version drift, missing pages,
missing images — that run anywhere with nothing to install.

## Market

Checked 2026-09-09.

| Vendor | Offers | Approach |
|---|---|---|
| Contentful | Sends its API logs to the customer's storage, for their own monitoring tools | Export to the customer's tools |
| Sanity | Traces what's on screen back to the content field it came from | Content tracing |
| Contentstack | Nothing found | — |
| Anyone | Setup checks, or image checks that understand the content | Nobody |

- dotCMS is behind Contentful on this kind of data, and with tracing deferred we add none. Don't
  pitch this as category-leading.
- If tracing comes back, follow Contentful: send the data to the client's own tools. That puts us
  next to the client's monitoring vendor, whom they already pay.

## Effort

About half a day remains; stage estimates are in the [plan](./03-plan.md#status). The doctor, the
watchdog and the image fixes are done, and the speed checks are well understood. The first
estimate was 8.5–11 days. Dropping browser monitoring (D2) and tracing (D3) removed the riskiest
work, and cutting low-value items and answering the open questions (both on 2026-11-03) removed
another 1–2 days.

## Cost

**Building the first version: $0 a month.** The tools are a command-line program plus code
changes, run on a developer's machine against the existing site. There's nothing new to host.

**For clients:** they run the tools themselves, by hand now and in their CI later, so dotCMS pays
nothing. If they want hosted checks, Checkly Team costs $64 a month; running Playwright themselves
is free, but someone has to maintain it.

**A hosted version isn't planned.** If dotCMS ever hosted monitoring data for clients (only if
tracing comes back), it would take 0.5–1 full-time engineer plus infrastructure: servers, data
retention, keeping clients' data apart, privacy scrubbing, EU data storage and on-call. That cost
is one reason we're not committing to a product (D15).

## Risks

For:
- Nobody else offers setup checks or content-aware image checks.
- It targets how headless sites actually fail.
- It's proven: the problems above are real.
- It's mostly website code, so it works across dotCMS versions.
- It's cheap: $0 to build, and nothing to host.
- It gives the organisation a standard it doesn't have yet.

Against:
- **Support is the real cost.** Code in client projects means owning breakages in their builds,
  Node versions and networks. That never shows in estimates, and it's how projects like this lose
  money. Clients owning the code after handover (D14) limits it.
- **The SDK changes underneath us.** Rely only on its public features.
- **Scope creep.** Watchdog results invite requests for alerts and dashboards. Those are out of
  scope (D3); say so up front.
- **Margin erosion.** A package customised for every client stops being a package. Keep it
  configurable, not copied and changed.
- **The read-only limit.** The demo can't show anything inside dotCMS. Say so up front.

The trade-off: building it is cheap; supporting it forever isn't. It pays off if it becomes the
standard on every headless project, so the support cost is shared. It doesn't if it's an occasional
add-on, maintained by whoever touched it last.

## Packaging

1. **Our own reference first.** The default for every future headless project. No pricing, service
   levels or support team needed.
2. **Professional Services package second.** PS delivers these projects; a configurable package
   speeds up delivery and is billed as part of the engagement.
3. **A product only if demand proves it.** A product needs versioning, upgrades, support guarantees,
   and hardening for many clients. A small first version against a read-only system proves none of
   that.

Each step produces the evidence for the next, so nothing irreversible is decided up front.

## How to present it

- The problems (F1–F5) are in **our own** project. "Look what we found in a client's build" is
  accurate, but it backfires. Present them as *why we built the tools*: the team that wrote the code
  couldn't see these problems without them.
- Don't call the image proxy's handling of browser format requests a defect, as the September
  docs did. It has no effect (D11).
- End the demo with: every finding was invisible in a project that passed review and shipped.
- The speed checks (P5) are the easiest part to sell: everyone understands slow pages.

## Sources

- [Contentful Enterprise Observability](https://www.contentful.com/developers/docs/concepts/enterprise-observability/) ·
  [announcement](https://www.contentful.com/blog/contentful-enterprise-observability/)
- [Monitoring and observability for enterprise CMS](https://www.enterprisecms.org/guides/monitoring-and-observability-for-enterprise-cms)
- [Sanity Content Source Maps](https://www.sanity.io/sanity-vs-contentstack)
- [dotCMS features — Enterprise, Cloud, Community](https://www.dotcms.com/product/features)
