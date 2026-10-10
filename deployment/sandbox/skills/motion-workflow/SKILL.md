---
name: motion-workflow
description: After creating or changing animations, transitions, menus, accordions, modals or other transient UI, load this skill and inspect the affected interactions by default, without a separate request; respect explicit skip/defer-recording instructions. Also investigate blink, jump, flicker, flash, glitch and layout shift with frame-by-frame evidence, progress findings and before/after videos.
---

Use the `motion` CLI in this computer. It is `node /opt/qm-motion/cli/cli.mjs`;
run it with `execute`. `node /opt/qm-motion/cli/cli.mjs help` shows every
option. Every command prints one JSON object with a `next` hint.

## When to inspect

After creating or changing temporal UI behavior, inspect the affected
interaction before saying the work is complete. This includes animation or
transition CSS, mount/unmount timing, opening and closing menus, accordions,
modals, transient loading states, and changes that move content during an
interaction. A separate request for recordings is not required. Check only
the interactions the edit can affect, including their reverse or repeat action
when relevant; unrelated text, data or backend edits do not trigger captures.

Explicit user instructions to skip or defer recordings take precedence for
their stated scope and duration. Say the motion check was skipped or deferred;
do not call that behavior verified. A later request to inspect it resumes the
workflow. Never infer a standing opt-out from an earlier task's instruction.

For an existing interaction, retain baseline takes before editing when
possible, then repeat the same scenario after editing. For newly built UI or
an edit already made without a baseline, inspect the current implementation
first. If it has a defect, those takes become the before evidence for the
repair. If it is clean, report the current revision's per-take results without
inventing a before/after improvement or resetting source to obtain one.

Use the app's existing local server, or start it with `background` when that
is within the task's authorization. If the app, Chromium, CLI or `motion_view`
is unavailable, name the missing prerequisite, report the interaction as
unchecked, and continue any independent work. An exit code, screenshot or
unviewed file path does not verify temporal behavior.

## Loop

1. **Write a scenario** for the interaction: a JSON file anywhere under
   `/root/workspace` (format: `node /opt/qm-motion/cli/cli.mjs help scenario`).
   `watch` names *where to look* (the elements that move, appear or disappear);
   their size, position and visibility are traced every display frame. Set
   `appDir` to the app's Git working copy so each take records its revision.
   The app server must already be running (start it with the `background` tool).
2. **Capture** fresh takes (a new browser each time; 3 by default):
   `node /opt/qm-motion/cli/cli.mjs capture --scenario /root/workspace/<your-scenario>.json --label before`
3. **Inspect** one take:
   `node /opt/qm-motion/cli/cli.mjs inspect <take-id>` shows the whole take.
   Read the table first: it has one row per frame where a watched value
   changed, with exact page times in ms from the trigger. Then narrow the
   window to the moment that matters:
   `node /opt/qm-motion/cli/cli.mjs inspect <take-id> --from <ms> --to <ms> [--crop x,y,w,h]`.
4. **Look at the pixels.** Pass a printed `sheets[].path` verbatim to the
   `motion_view` tool to confirm what the numbers suggest. Long windows are
   split across several sheets automatically; view the ones covering your
   moment. Never describe an image you have not viewed with `motion_view`.
   Images last one turn; call `motion_view` again in later turns.
   Share the initial finding and a relevant visual as described below before
   trying a fix; do not save all findings for the final reply.
5. **Relate it to the code**, edit the app, then capture new takes of the same
   scenario (`--label after`) and compare:
   `node /opt/qm-motion/cli/cli.mjs compare --before <id,id,id> --after <id,id,id> --from <ms> --to <ms>`.
   View every compare sheet with `motion_view`. Compare reports change, not
   quality: you judge whether the requested behavior is now right. Compare
   also makes a synchronized comparison player with slow motion, frame
   stepping and take selectors, plus downloadable clips. Attach every path
   in `video.attach`; the player and separate MP4s are for the user.

## User demonstrations and sequences

When the user attaches `motion-demonstration.json` from the live preview,
read its description and initial-state limitations, save it under the workspace,
and use it as the capture scenario. Its locators and ordered actions are
already supplied. Add `appDir` and a focused `watch` list when useful. Do not
rewrite the demonstrated sequence or import browser credentials silently;
report an unreproducible starting state or unsupported action explicitly.

For interrupted/repeated interactions use `actions` with IDs and requested
`atMs` offsets instead of a single `trigger` (see `help scenario`). Capture
reports actual dispatch/event times independently. `--align-action <id>` on
inspect and compare selects the observed action used as zero; use the same
anchor on both sides. Report partial captures and their failed actions rather
than calling them a pass. `compare --markers <file.json>` adds labelled
intervals: an array of `{fromMs,toMs,label,description}` in the selected
alignment's milliseconds. Choose intervals from inspected evidence.


## Findings while work continues

Use the current conversation, without waiting for a user reply at each stage.
Explain the interaction you are reproducing, then speak when actual work
produces a finding or changes the plan. Useful checkpoints are reproduction,
initial inspection, the proposed edit, and rechecking. Do not fabricate
percentages, announce every tool call, or repeat empty status messages.

After reading the initial table and viewing the relevant sheet, report what
you observed, where to look, trigger-relative timing and occurrence across
takes. Separate the observation from a provisional explanation: for example,
"The menu shifts left during opening in 2/3 takes near +120 ms. I suspect
its placement is recalculated after paint; I am checking that code." Use
only your actual measurements; this example is not a diagnosis to assume.
If no defect is observed, say so with the checked scope and limitations.

Send one relevant, already-viewed cropped sheet with this initial finding;
an explicit request is not needed for this interim evidence. Convert a
`/root/workspace/…` path to its workspace-relative form for attachment tools.
`motion_view` gives you vision, not a user attachment. On a conversation
surface exposing a `post` action with `files`, post the finding and file in
the current conversation, check its delivery result, then continue work.
Do not use `reach` or send to another audience.

In ordinary QM web turns, write a short assistant message before your next
tool call; these messages stream while work continues. Immediately deliver
the already-viewed initial sheet with
`attach({"files":["<workspace-relative sheet path>"],"delivery":"immediate"})`.
Check the result confirms immediate delivery before proceeding to the repair.
This opt-in sends the file through this conversation's live run stream;
it does not queue the file for the closing reply. Use the same mode for a
viewed sheet explaining a rejected candidate. Omit `delivery` for final
comparison attachments, which keep their normal end-of-turn behavior.

If the tool rejects immediate delivery or does not expose the option, name
that runtime limitation. Queue the sheet with ordinary `attach` and confirm
its result, but say it will accompany the report rather than claiming it is
already visible. Streamed text and a queued file do not fulfill interim
visual delivery. Continue independent investigation and deliver the queued
evidence with the report; never require another user prompt to flush it.

If a candidate fix fails or introduces another problem, promptly revise the
finding with what the fresh takes showed: identify the rejected approach,
the remaining or new behavior, and the next step. Attach a relevant viewed
sheet when it explains the changed finding, using the same delivery rules.
Do not call a candidate fixed before rechecking, and do not present its
comparison as the final result. Keep its evidence separate from the retained
fix's takes and check related reopen/repeat behavior when applicable.

## Evidence rules

- A defect can last a single display frame (~16.7 ms). View every frame in the
  window, not a sample, and use several takes; one clean take proves nothing.
- Table times are exact page frame times. Sheet times are capture times, about
  9–28 ms after the paint they show, so cite both honestly.
- Report every take, including ones where the defect did not appear, and any
  compare warnings. Frame rate is not proof of smoothness.
- Cite the take ID, table row times and the sheet frames (`#N`) you viewed.

## Reply to the user

For a retained repair, the final reply stands alone: state the observed
problem, the change kept, the per-take results, any rejected fix that affected
the investigation, and limitations or unchecked interactions. Tables and
sheets are your evidence; the user gets a synchronized Before/After player
and separate clip downloads. Attach every `video.attach` path from the final
compare whose after takes hold the retained fix. Prefer `comparison.html`
when present; a render failure can leave the original separate Before/After
players as a fallback, and must be reported. Explain where to look and how to
use slow motion or a marker. The clips are separate attachments because QM's
HTML iframe restricts downloads. You cannot see the generated player: describe
only what the tables and sheets you viewed show. Interim finding sheets are
allowed above; avoid attaching every sheet or duplicating them in the final
reply unless needed to explain a limitation or requested by the user. If no
repair was needed, report the inspected current state rather than making an
unchanged comparison and claiming an improvement.

## Case record (last step)

Write one case after the investigation. GBrain lowercases slugs, so lowercase
the take ID: `gbrain put cases/motion-<first-before-take-id, lowercased> --content '<markdown>'` with the
request, scenario name, app revision before and after, take IDs, observed
intervals (ms from trigger), diagnosis, change made, per-take before/after
result, sheet paths, and a unique token. Verify with
`gbrain get` on that same lowercase slug and `gbrain search '<token>'`.
Write only under `cases/`. If GBrain fails, say so plainly in the reply; it
never stops capture, inspection or the report.
