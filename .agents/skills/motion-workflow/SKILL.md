---
name: motion-workflow
description: Develop or verify QM Motion's capture-inspect-edit-repeat-compare loop using bounded temporal evidence. Use for the motion MVP and demo.
---

Read `docs/architecture.md`, `docs/plan.md`, and `docs/demo.md`.
`capture`, `inspect`, and `compare` are proposed product operations until
PROGRESS.md records a working implementation. Do not invent CLI commands.
First prove that a QM model receives image content, not just a filename.

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
