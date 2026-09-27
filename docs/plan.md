# Implementation plan

This doc owns the **order of work, the risks, and what "done" means** for each
step. How the system works is in [architecture.md](architecture.md); read its
[top-down overview](architecture.md#how-it-works-top-down) and
[what we build](architecture.md#what-we-build) first. Exact formats, flags and
test procedures are in [spec.md](spec.md). Terms are defined in
[brief.md](brief.md#terms). Live status is in [PROGRESS.md](../PROGRESS.md).

Budget: September 27, 2026, 1:15–5:00 PM Pacific, **225 minutes**.

## How to work (hackathon rules)

- **Build, don't re-investigate.** Everything under "Already settled" below
  is proven. Do not spike, benchmark or re-test it; go straight to the code.
- **One check per milestone.** Each milestone's "done when" is the only
  required check. No extra harnesses, test suites or coverage work. If a
  check fails, fix the code and rerun that same check.
- **The spec is the default, not a cage.** If something simpler meets the
  same "done when", do it, and change [spec.md](spec.md) in one line so the
  docs stay true. Never weaken the core rules: real image delivery, no
  sampling of frames in a window, no supplied diagnosis.
- **Timebox.** If a milestone runs 15 minutes over, cut scope using the cut
  order below rather than polishing.
- **Run from the primary checkout.** Services, `npm` scripts, `.state/`,
  `deployment/.env`, `node_modules` and `artifacts/` live in the primary
  checkout (on this machine `/home/charlie/home/charlie/Documents/CODE/yc-hacks-9-27`).
  Git worktrees lack these ignored files and cannot run anything. Edit and
  commit wherever you like, but run from there. Spike evidence (including
  `artifacts/motion-spike/scripts/pw-alt.mjs`) is only there too.

## Where we start

Before the build window, both risky foundations were checked:

- **Image delivery.** QM's source was read, and OpenAI was tested directly.
  GPT-6 Sol reads images returned inside a tool result; QM passes such images
  through but has no tool that returns one. We add `motion_view`.
  [Details](architecture.md#image-delivery-verified-by-reading-the-code).
- **Capture.** Measured in the QM computer. Chrome's raw screencast caught
  the one-frame rebound in 7 of 7 takes, with real frame timestamps.
  [Details](architecture.md#capture-measured).

Nothing in [What we build](architecture.md#what-we-build) exists yet.

**Already settled; do not re-verify:**

- The capture method: raw CDP screencast plus a rAF trace, with launch
  code in `artifacts/motion-spike/scripts/pw-alt.mjs`.
- GPT-6 Sol reading images inside tool results, directly and through pi
  inside QM core.
- The Field Notes locators, tested on the live page.
- The FFmpeg label and tile commands.
- How skills deploy (`npm start`), and how to restart after a sandbox rebuild.
- That QM's tool layer cannot install files on the local backend.
- That pi's public `resizeImage` shrinks any image to fit (tested in core),
  so size never needs special handling beyond what spec §1 and §6 say.

## Milestones

Each milestone leaves something demonstrable. A **real turn** is an actual QM
conversation turn with GPT-6 Sol ([spec §2](spec.md#2-running-real-turns)),
not a script calling our code directly. "Run directly" means
`npm run computer -- node /root/workspace/motion/cli.mjs …`, with no QM turn.

| # | Minutes | Build | Done when |
| --- | --- | --- | --- |
| 1 | 0–30 | `motion_view` core patch ([spec §1](spec.md#1-motion_view-qm-core-patch)); `qm-turn.mjs` flags ([§2](spec.md#2-running-real-turns)); deploy with `npm start` | **One real turn** reports a random code visible only inside a PNG returned by `motion_view` ([spec §10](spec.md#10-tests)). |
| 2 | 30–60 | `motion capture` with the trace sampler and the Field Notes scenario ([spec §3–5](spec.md#5-motion-capture)) | Run directly in the computer (no QM turn): `--takes 3` writes frames, `frames.json`, `trace.json` and a manifest, and the traces show the one-frame reopen. |
| 3 | 60–80 | `motion inspect` ([spec §6](spec.md#6-motion-inspect)) | Run directly: prints the table and writes sheets (split automatically) for a take from milestone 2. |
| 4 | 80–100 | `motion compare` ([spec §7](spec.md#7-motion-compare)) | Run directly on the milestone 2 takes: per-take tables plus sheets, and a take with a different viewport is refused (copy the scenario with another `viewport` and capture 1 take). |
| 5 | 100–160 | Guidance skill ([spec §8](spec.md#8-agent-guidance-deploymentsandboxskillsmotion-workflowskillmd)); `npm run demo -- reset`; the server is handed to the agent ([spec §2](spec.md#2-running-real-turns)) | **The real run:** in one turn the agent captures, reads the table, views the sheet and correctly describes the rebound, citing the frame (tool success). It writes the GBrain case ([spec §9](spec.md#9-gbrain-case)). Demo goal, not required: it also fixes the bug and shows before/after with `motion compare`. |
| 6 | 160–225 | Rehearse, fix failures, freeze | A second real run from reset; one fresh turn retrieves the case; a labelled recording of a real run exists; PROGRESS.md updated. See [demo.md](demo.md). |

Only milestones 1, 5 and 6 use real QM turns. Everything else is checked by
running our commands directly, which is fast and free.

If setup eats build time, subtract it at once and cut from the list below.
Keep the final 30 minutes for rehearsal and freeze. Never report an
environment failure as a finished milestone.

## Risks

**Could block a milestone:**

- **Our patch (milestone 1).** Everything from pi to the model is proved.
  On September 27, pi's own library (the copy inside the running QM core)
  sent a tool-result image block with a `gpt-6-sol` model object built like
  QM's. The model read a withheld code correctly (`pi-probe.mjs` and
  `pi-result.json` in `artifacts/openai-tool-image-probe/`). A direct API
  call also passed. Only QM's tool wrapper (read as pass-through) and our new
  code remain, and test 2 covers both. If it fails, the fault is in our patch
  or the wrapper.
- **A single missed frame (milestones 2 and 5).** The rebound is on screen for
  exactly one frame, and a skipped screencast frame can hide it. Mitigations:
  several takes, every frame in the window, and reporting takes where the
  defect did not appear.

**Known constraints, not blockers:**

- **Timing labels.** A frame arrives about 9–28ms after the page state it
  shows. Label times as capture times, not paint times.
- **Images last one turn.** Later turns must call `motion_view` again.
- **No security notice.** Checked: posture `auto`, but screening is off
  (`SECURITY_SCREEN_BACKEND=off`), so `motion_view` results pass unmodified.
- **Rebuilding the sandbox image** recreates the computer, kills running jobs
  (including the demo server) and drops its GBrain network. Follow the
  [three-step procedure](architecture.md#sandbox-image-changes). That's why the
  CLI runs from `/root/workspace` until it is stable.
- **Attach PNG, not video.** The web chat shows attached images inline; video
  only gets a download card.
- **Always name the test conversation.** `qm-turn.mjs` without `--thread` posts
  into one shared default conversation ([spec §2](spec.md#2-running-real-turns)).

**Scope.** The motion tools are debugging evidence. They make the agent aware
of what happens on screen over time; choosing and making the fix is the
agent's job. Demo-specific fix notes are in [demo.md](demo.md#notes-for-later).

## Cut order

Cut from the top when time runs short.

1. Metrics, heatmaps, optical flow, motion scores, profiler integration.
2. Chrome animation details (`animations.json`, [spec §7a](spec.md#7a-chrome-animation-details-optional-cut-early)).
3. A general interaction language or broad app support; keep one scenario file.
4. Multiple providers, harnesses or browsers, polished UI, dashboards.
5. Baking the CLI into the sandbox image; keep running it from `/root/workspace`.
6. Smart frame selection; keep a fixed window plus manual crop.
7. Semantic memory; keep the scoped case write and keyword retrieval, and
   report any memory blocker separately.

Never cut the core loop: request → visible frames → agent edit → repeat →
visible comparison. Never replace the real target with an invented bug, or
image delivery with a filename.

## Next concrete task

Milestone 1: write `motion-evidence-image.patch` against the running core
source, rebuild with `npm start`, and prove with a real turn that `motion_view`
delivers the withheld code.
