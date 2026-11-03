# VIP Offerings — Overview

**What:** add-on tools that catch hidden problems in headless dotCMS websites. We're building them
on this CITGO project first.

**Why:** headless sites break in ways normal testing misses: wrong settings, images that never
cache, an SDK that falls behind dotCMS. This project had several such defects that nobody noticed
([evidence](./02-evidence.md#defects-found)).

**Status (2026-11-03):** the first tool, the doctor, is built. Hardening it (Stage 1b) is next.
About 3.5–5 days of work remain.

## The five parts

| ID | Part | What it does | When |
|---|---|---|---|
| P1 | dotCMS call tracing | Would time each call the site makes to dotCMS | Deferred (D3) |
| P2 | Doctor | Checks the site's settings and its dotCMS connection before deploy | Built; Stage 1b next |
| P3 | Watchdog | Runs the doctor's checks against the live site on a schedule, plus content checks | Stage 4 |
| P4 | Image fixes | Fixes image caching, image quality, and how the main image loads | Stage 2 |
| P5 | SEO and speed | Fails CI when pages get slower or heavier; SEO extras only if Q2 says so | Stage 3 |

## Documents

| Doc | What's in it |
|---|---|
| [Decisions](./01-decisions.md) | What we decided and why (D1–D15), what's out of scope, open questions (Q1–Q5) |
| [Evidence](./02-evidence.md) | Measurements, what we verified in the code, defects found (F1–F6) |
| [Plan](./03-plan.md) | The build, stage by stage, including the doctor's bugs (B1–B7) |
| [Business case](./04-business-case.md) | Why build it, cost, risks, market and packaging |

## Ground rules

1. **The client's dotCMS is read-only.** It's their live dev system. We only read from it.
2. **It's rate-limited.** Keep requests few.
3. **The doctor installs nothing.** It runs on plain Node 22.18 or newer (D9).
4. **Follow the repo conventions** in `AGENTS.md`.

## Working rules

- Reuse the [evidence](./02-evidence.md). Don't re-measure the client's dotCMS.
- Develop the doctor against its fake local dotCMS (from Stage 1b), not the client's.
- Take before/after numbers and screenshots when you change something.

## Open questions

- **Q1** How does CITGO's own deployment build its pages?
- **Q2** Is the next milestone for CITGO, or for our own reference?
- **Q3** How long should browsers cache images?
- **Q4** Should the watchdog check every article, and be built right after Stage 1b?
- **Q5** Where can the watchdog run for CITGO?

Details and recommendations: [Decisions](./01-decisions.md#open-questions).

## Timeline

| Date | What happened |
|---|---|
| 2026-09-03 | Measured the client's dotCMS; found three defects (F1–F3) |
| 2026-09-09 | Browser monitoring cut |
| 2026-09-11 | Doctor built; a health-check web page built and removed the same day (D8) |
| 2026-11-02 | Plan audited and rewritten; doctor bugs and three more defects found |
| 2026-11-03 | Tracing deferred; doctor made install-free; low-value items cut |

## Next step

Build [Stage 1b](./03-plan.md#stage-1b-harden-the-doctor-next). It doesn't wait on any open
question.
