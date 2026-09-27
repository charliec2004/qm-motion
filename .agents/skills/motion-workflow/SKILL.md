---
name: motion-workflow
description: Develop or verify QM Motion's capture-inspect-edit-repeat-compare loop using bounded temporal evidence. Use for the motion MVP and demo.
---

Read `docs/plan.md` (order, hackathon rules, what is already settled), then
`docs/spec.md` (exact contracts) and `docs/architecture.md` (why). Build the
`motion` commands and the `motion_view` tool exactly as the spec defines them;
do not add other commands. They are unimplemented until PROGRESS.md says
otherwise. Start with milestone 1: prove a real QM turn sees an image returned
by `motion_view`.

Use the real pinned demo and a reset state. Capture short local Chromium
interactions with fixed viewport and logged actual trigger/frame timestamps.
Inspect a bounded interval/region; the agent diagnoses intent and source code.
Repeat the same interaction after editing; align to the trigger and report
limitations. Nominal FPS and pixel differences do not prove smoothness.
Store a concise GBrain `cases/` record with app revision, reproduction, observed
defect, fix, measured checks, and artifact references. Do not store raw videos.
Memory failure must not block recording or inspection.

QM's runtime guidance is separately installed under
`deployment/sandbox/skills/motion-workflow/`.
