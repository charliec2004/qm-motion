# Starting point (disclosure)

What existed when the build window opened: September 27, 2026, 1:15 PM
Pacific. Hackathon work is everything after this baseline.

**Baseline commit:** `525476e` on `main` (12:01 PM). To see hackathon work
alone, run `git diff 525476e..main` or `git log 525476e..main`.

## Third-party software we build on (not our work)

- **QM:** npm CLI `@yc-software/qm@0.1.12`; core image
  `ghcr.io/yc-software/qm/core@sha256:8859f0de…`; sandbox base
  `ghcr.io/yc-software/qm/sandbox-base@sha256:9c632c83…`. Its bundled `pi`
  harness is 0.82.0.
- **Model:** OpenAI GPT-6 Sol through the project's own API key.
- **Browser and media tools:** Chromium 154.0.8037.57, Playwright 1.63.0,
  agent-browser 0.38.1 and FFmpeg 5.1.9, all installed in the agent computer.
- **Other services:** GBrain 0.59.0.0 with PostgreSQL 16 (pgvector), Caddy
  2.10.2, and Tailscale.
- **Demo dependencies:** `@radix-ui/react-accordion@0.1.5` and React
  `18.0.0-rc.0`, whose real, public close-animation bug is Radix issue #1074.

Pins and licenses are in [references.md](references.md).

## Our pre-hackathon work

**Environment (a working, stock-behaving QM deployment).** QM was not
extended with any product feature. What we did:

- **Scripts:** setup, start, stop, status, login, computer access, demo and
  smoke-check scripts in `scripts/`.
- **Two small core patches** in `deployment/runtime/patches/`:
  - `local-core-address.patch` lets core reach the local agent computer;
  - `model-request-retry.patch` sets pi's existing request timeout and retry.
- **GPT-6 Sol registration** through QM's supported model registry.
- **A sandbox image** with Chromium, Playwright, agent-browser, FFmpeg and
  the GBrain client.
- **A GBrain service and scoped client**, plus private Tailscale access to
  the web UI.
- **Verification:** real model, command, vision, memory and UI checks passed
  (see [PROGRESS.md](../PROGRESS.md)).

**Demo target.** Field Notes (`demo/`) is a small original FAQ app that
reproduces the real Radix bug with unmodified dependencies. It contains no
fix and no planted defect.

**Skills:**

- four architecture skills copied from Matt Pocock's repository;
- two project developer skills in `.agents/skills/`;
- two QM runtime skills in `deployment/sandbox/skills/`. These are still the
  old guidance.

**Research and planning.** Nothing here is product code.

- **The docs:** [brief](brief.md), [architecture](architecture.md),
  [spec](spec.md) and [plan](plan.md), together with this file.
- **Throwaway spikes and probes**, with evidence in the ignored `artifacts/`
  directory:
  - a capture-fidelity spike in the agent computer
    (`artifacts/motion-spike/`);
  - direct and pi-library image-delivery probes against OpenAI
    (`artifacts/openai-tool-image-probe/`);
  - a live check of the page locators and an FFmpeg label and tile test.

## Not started before the window

- **The `motion` CLI** (capture, inspect, compare). `src/` does not exist
  yet.
- **The `motion_view` core patch**, `motion-evidence-image.patch`.
- **The `qm-turn.mjs` flags** (`--thread`, `--timeout`).
- **The rewritten motion-workflow runtime skill.**
- **Any agent investigation or fix** of the Field Notes bug.

## How the pre-hackathon commits were made

Commits `51f2999` through `525476e` (10:53 AM to 12:01 PM) were written with
AI coding assistance, recorded as Claude co-author trailers in `git log`. The
earlier commits `1c645de` (kickoff) and `4ce8e45` (Tailscale access) carry no
co-author trailer.
