---
name: motion-workflow
description: Inspect a local web interaction over time, repeat it after a code change, and retain an evidence-backed QM Motion case. Use for animation, flicker, and layout movement investigations.
---

The motion extension's `capture`, `inspect`, and `compare` operations are NOT
implemented by this kickoff. Do not present them as existing commands.
Stock `agent-browser` recording is installed: open the target's localhost URL,
set the viewport, then `agent-browser record start /root/workspace/artifacts/run.webm --contact-sheet`,
perform the interaction, and `agent-browser record stop`. Keep captures 3–10s.
Stop recording before closing the browser. Use fresh browser state per run.

Preserve browser version, viewport, app revision, reset state, exact interaction,
and actual action/frame timestamps. Inspect intermediate frames, not just the
final screenshot. A file path or text-only `read` result is not visual evidence
in your model context. Until the image bridge exists, report that limitation;
incoming QM image attachments can be inspected after their real vision check.
Do not infer frame timing from nominal recording FPS.

Diagnose from evidence and application source. After editing, rerun the same
interaction from reset state; align comparisons on the trigger. Judge whether
the requested behavior improved, and state any comparability limitations.

Save only a compact durable case: `gbrain put cases/<case-id> --content '<markdown>'`.
Include reproduction, app revision, observations, code fix, measured outcome,
and published artifact references. Verify with `gbrain get cases/<case-id>` and
`gbrain search '<distinctive case token>'`. Never store raw recording bytes.
Write only under `cases/`. A GBrain outage must not block capture or inspection.
