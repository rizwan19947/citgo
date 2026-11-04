# VIP Offerings — Overview

**What:** add-on tools that catch hidden problems in headless dotCMS websites. They're built for
any project that follows this reference setup, and developed and tested on CITGO.

**Why:** headless sites break in ways normal testing misses: wrong settings, missing content, an
SDK that falls behind dotCMS. This project had several such problems that nobody noticed
([evidence](./02-evidence.md#defects-found)).

**Status (2026-11-04):** the first tool, the doctor, is built. Hardening it (Stage 1b) is next.
About 3–4 days of work remain.

## The five parts

| ID | Part | What it does | When |
|---|---|---|---|
| P1 | dotCMS call tracing | Would time each call the site makes to dotCMS | Deferred (D3) |
| P2 | Doctor | Checks the site's settings and its dotCMS connection before deploy | Built; Stage 1b next |
| P3 | Watchdog | Checks a running site: its key pages, newest articles and their images. Run by hand for now | Stage 2 |
| P4 | Image fixes | Fixes image quality and how the main image loads | Stage 3 |
| P5 | Speed checks | Lighthouse fails the run when pages get slower or heavier | Stage 4 |

## Documents

| Doc | What's in it |
|---|---|
| [Decisions](./01-decisions.md) | What we decided and why (D1–D16), and what's out of scope |
| [Evidence](./02-evidence.md) | Measurements, what we verified in the code, problems found (F1–F6) |
| [Plan](./03-plan.md) | The build, stage by stage, including the doctor's bugs (B1–B7) |
| [Business case](./04-business-case.md) | Why build it, cost, risks, market and packaging |

## Ground rules

1. **The client's dotCMS is read-only.** It's their live dev system. We only read from it.
2. **It's rate-limited.** Keep requests few.
3. **Keep scope small.** Build only what's needed, not what we could (D5).
4. **No CITGO-specific code in the tools.** CITGO's details are settings in the env file (D15).
5. **The doctor installs nothing.** It runs on plain Node 22.18 or newer (D9).
6. **Follow the repo conventions** in `AGENTS.md`.

## Working rules

- Reuse the [evidence](./02-evidence.md). Don't re-measure the client's dotCMS.
- Develop against the fake local dotCMS (from Stage 1b), not the client's.
- Runs against the client's dotCMS or the live site need the owner's OK.
- Take before/after numbers and screenshots when you change something.

## Open questions

None right now. The five open questions were answered on 2026-11-03; the answers are in D4, D5,
D6, D10, D11 and D15.

## Timeline

| Date | What happened |
|---|---|
| 2026-09-03 | Measured the client's dotCMS; found three problems (F1–F3) |
| 2026-09-09 | Browser monitoring cut |
| 2026-09-11 | Doctor built; a health-check web page built and removed the same day (D8) |
| 2026-11-02 | Plan audited and rewritten; doctor bugs and three more problems found |
| 2026-11-03 | Tracing deferred; doctor made install-free; low-value items cut |
| 2026-11-03 | Open questions answered: client-agnostic and server-rendered only; no SEO extras; no image caching; watchdog next, run by hand |
| 2026-11-04 | Watchdog scoped to the newest items (D16); project details moved to env settings |

## Next step

Build [Stage 1b](./03-plan.md#stage-1b-harden-the-doctor-next). Nothing blocks it.
