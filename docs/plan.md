# Implementation plan

This doc owns the **order of work, the risks, and what "done" means** for each
step. How the system works is in [architecture.md](architecture.md); read its
[top-down overview](architecture.md#how-it-works-top-down) and
[what we build](architecture.md#what-we-build) first. Exact formats, flags and
test procedures are in [spec.md](spec.md). Terms are defined in
[brief.md](brief.md#terms). Live status is in [PROGRESS.md](../PROGRESS.md).

Budget: September 27, 2026, 1:15–5:00 PM Pacific, **225 minutes**.

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

## Milestones

Each milestone leaves something demonstrable. "Real turn" means an actual QM
conversation with GPT-6 Sol, not a script calling our code directly.

| # | Minutes | Build | Done when |
| --- | --- | --- | --- |
| 1 | 0–30 | `motion_view` core patch ([spec §1](spec.md#1-motion_view-qm-core-patch)); `qm-turn.mjs` flags ([§2](spec.md#2-running-real-turns)); deploy with `npm start` | [Spec §10](spec.md#10-tests) tests 1–4 pass: a real turn reports a random code visible only inside the PNG, and the four bad paths each return the right error. |
| 2 | 30–60 | `motion capture` with the trace sampler, and the Field Notes scenario ([spec §3–5](spec.md#5-motion-capture)) | One take produces frames, `frames.json` with Chrome timestamps, `trace.json` for the watched elements, and a manifest with app revision, browser version, viewport, trigger time and timing source. Three takes' traces show the one-frame reopen measured in the spike. |
| 3 | 60–80 | `motion inspect` ([spec §6](spec.md#6-motion-inspect)) | A real turn captures, reads the table, views the sheet, and describes the reopened frame. Labels are ms from the trigger; invalid windows fail; sheet ≤ ~1 MB. |
| 4 | 80–120 | Guidance skill ([spec §8](spec.md#8-agent-guidance-deploymentsandboxskillsmotion-workflowskillmd)); `npm run demo -- reset`, then the server is handed to the agent ([spec §2](spec.md#2-running-real-turns)) | **Tool success:** in a real turn the agent reproduces the rebound and describes it correctly from the table and sheet, citing the frame. **Demo goal** (not required for the tool): it also finds the cause and makes a change it justifies. No diagnosis is supplied. |
| 5 | 120–155 | `motion compare` ([spec §7](spec.md#7-motion-compare)); three or more takes per side | Per-take tables and a trigger-aligned before/after sheet show every take, and the agent judges each take. Mismatched runs are rejected or visibly labelled. |
| 6 | 155–175 | Case write and retrieval ([spec §9](spec.md#9-gbrain-case)) | A fresh turn retrieves the case by a unique marker. With memory made unavailable, capture and inspection still work and the failure is reported. |
| 7 | 175–225 | Rehearse, fix failures, freeze | Full-loop latency measured from reset; a labelled recording of a real successful run exists; PROGRESS.md updated. See [demo.md](demo.md). |

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
- **A single missed frame (milestones 3 and 5).** The rebound is on screen for
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
