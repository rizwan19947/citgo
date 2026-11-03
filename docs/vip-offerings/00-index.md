# VIP Offerings — Start Here

An add-on suite for headless dotCMS frontends, prototyped on this CITGO project. The deliverables
are a CLI and a library that any headless build can adopt.

**Status (2026-11-03):** Stage 1 — the `doctor` CLI — is built. Stage 1b, hardening it, is next.
Everything else is planned, not built: about 4–6 days of work. Observability is deferred (D3).

## Pillars

| ID | Pillar | What it does | Stage |
|---|---|---|---|
| P1 | dotCMS call tracing | Deferred — no OpenTelemetry for now (D3) | — |
| P2 | Config preflight (`npm run doctor`) | Checks env, dotCMS reachability, SDK↔core version drift, the `/dA` proxy and every site's wiring before deploy | 1 (built), 1b |
| P3 | Watchdog | P2's checks plus content checks (pages, assets, search), run on a schedule against a deployed site | 4 |
| P4 | Image pipeline | Fixes `/dA` caching, image quality and how the hero image loads; optional LQIP placeholders | 2 |
| P5 | SEO & performance baseline | Lighthouse CI budgets; sitemap, JSON-LD and reusable metadata builders only if Q2 says so | 3 |

## Documents

| Doc | Read it for |
|---|---|
| [01-decisions](./01-decisions.md) | What's settled (D1–D14), what's out of scope, open questions (Q1–Q7) |
| [02-evidence](./02-evidence.md) | Measurements, verified dotCMS / SDK / Next / Node behaviour, defects found (F1–F7), the client's deployment |
| [03-plan](./03-plan.md) | Stages, tasks and done-criteria — start here to build. Doctor bugs are B1–B9 |
| [04-business-case](./04-business-case.md) | Why build it, cost, risks, market, packaging |

Each fact lives in one doc. The others refer to it by ID (D, Q, F, B).

## Hard constraints

1. **The dotCMS instance is read-only.** It is the client's live dev environment, already handed
   off. No content types, fields, plugins or server config. Checks only read: GETs, plus the
   read-only `POST /api/content/_search`.
2. **A rate limiter is live** (`x-dotratelimit-toks-max`). Cap concurrency.
3. **Repo conventions apply** (see `AGENTS.md`): tabs, no `loader` prop on `<Image>`, the
   `citgo-red` / `citgo-link` tokens instead of hex, no `VERCEL_*`.
4. **The doctor runs on plain Node** (`node vip/runners/cli.mts`, Node ≥ 22.18). Only erasable
   TypeScript works there — no `enum`, `namespace` or parameter properties — and relative imports
   end in `.mts`. `tsc` won't catch a violation; running `npm run doctor` will.

## Working rules

- **Reuse [02-evidence](./02-evidence.md).** Don't re-measure the client's instance.
- **Develop against it cached:** `VIP_CACHE=1` replays reads from disk. Never set it in CI or the
  watchdog — a stale hit hides a real regression.
- **Capture demo evidence when you make a change** (before/after numbers, screenshots). It's hard to
  reconstruct later.

## Where to start

1. Answer the [open questions](./01-decisions.md#open-questions) — several change what gets built.
2. Build [Stage 1b](./03-plan.md#stage-1b-harden-the-doctor-next).
