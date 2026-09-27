# Implementation plan

The kickoff supplies the environment. The product work below remains proposed.
Read [PROGRESS.md](../PROGRESS.md) for passed checks and unresolved setup
dependencies, and [architecture.md](architecture.md) for the exact image bridge.
The Field Notes/Radix target and reset routine are pinned and verified in
[demo.md](demo.md). Keep that starting state fixed during product work.

Budget: September 27, 2026, 1:15–5:00 PM Pacific, **225 minutes**. Milestones are
ordered vertical slices; each leaves a demonstrable result.

| Minutes | Work and dependency | Acceptance check |
| --- | --- | --- |
| 0–45 | Capture → model vision. Requires real QM execution and browser setup. Wrap agent-browser for a bounded take/manifest; add the narrow pi image bridge, then rebuild and deploy core. | A QM turn describes facts visible only in an intermediate frame; recording and image are independently readable. Test invalid/out-of-scope evidence and a capture timeout. |
| 45–75 | Bounded inspection. Depends on the same run manifest. Add time/region selection and a readable contact sheet with launch/settle frames. | Requested interval/region appears with honest timestamp labels; invalid ranges fail; evidence stays within the image budget. |
| 75–120 | Real target investigation and edit. Depends on the pinned app and repeatable starting state. | Agent reproduces the observed issue, cites temporal evidence, finds relevant code, and makes a justified change without a supplied diagnosis. |
| 120–155 | Repeat and compare. Reuse the exact interaction and reset routine. | Trigger-aligned before/after evidence shows the result; mismatched viewport/state is rejected or visibly qualified. |
| 155–175 | Case write/retrieval. Uses the already connected scoped GBrain client. | Fresh turn retrieves the concise case by unique marker; simulated memory unavailability leaves capture/inspection usable and reports failed persistence. |
| 175–205 | Rehearse the exact demo and resolve failures. | Measure full loop latency, run from reset, check user-visible evidence links, prepare a labeled recording of a real successful run. |
| 205–225 | Freeze scope, one final run, report. | 60–90 second presentation fits measured reality; preserve evidence and update PROGRESS.md. |

If setup uses build-window time, subtract it immediately. Reserve the final
30 minutes for rehearsal/freeze and reduce implementation breadth. Do not
pretend environment failures are completed product milestones.

One verified cold agent command turn, after retrying a conversation containing
earlier failed attempts, took 78.467 seconds. This is not a clean full-loop
benchmark; it already makes an unmeasured 90-second live repair promise
unreasonable. Measure warm turns early and prepare an honestly labeled
recorded successful run if the full live workflow cannot fit.

## Cut order

1. Fancy metrics, heatmaps, optical flow, motion scores, profiler integration.
2. General interaction language and broad app support; keep one saved script.
3. Multiple providers/harnesses/browsers, polished UI, and a dashboard.
4. Sophisticated frame selection; use a small timestamped sheet plus manual
   interval/crop selection.
5. Automatic semantic memory enrichment; keep scoped case write and keyword
   retrieval, and report a memory blocker separately if one remains.

Preserve the real request → visible temporal evidence → agent edit → repeat →
visible comparison loop. Never replace the target with an invented broken CSS
line or replace image delivery with a filename.

## Next concrete task

Implement the first row only: one QM turn captures the selected local target
and actually sees a small frame sequence. Extend the existing tracked core
overlay only as needed, recording its exact base and validating the rebuilt
running image. Keep the operations local to
the run manifest and scoped image delivery rather than introducing an agent
framework or a generalized plugin system.
