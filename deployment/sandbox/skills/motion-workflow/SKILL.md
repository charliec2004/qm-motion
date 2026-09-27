---
name: motion-workflow
description: Investigate and fix things that go wrong on screen over time in a local web app (blink, jump, flicker, flash, glitch, layout shift, animation, transition) by recording the interaction frame by frame, reading per-frame measurements, viewing frame sheets, and comparing before/after takes.
---

Use the `motion` CLI in this computer. It is `node /root/workspace/motion/cli.mjs`;
run it with `execute`. `node /root/workspace/motion/cli.mjs help` shows every
option. Every command prints one JSON object with a `next` hint.

## Loop

1. **Write a scenario** for the interaction: a JSON file anywhere under
   `/root/workspace` (format: `node /root/workspace/motion/cli.mjs help scenario`).
   `watch` names *where to look* (the elements that move, appear or disappear);
   their size, position and visibility are traced every display frame. The app
   server must already be running (start it with the `background` tool).
2. **Capture** fresh takes (a new browser each time; 3 by default):
   `node /root/workspace/motion/cli.mjs capture --scenario /root/workspace/<your-scenario>.json --label before`
3. **Inspect** one take:
   `node /root/workspace/motion/cli.mjs inspect <take-id>` shows the whole take.
   Read the table first: it has one row per frame where a watched value
   changed, with exact page times in ms from the trigger. Then narrow the
   window to the moment that matters:
   `node /root/workspace/motion/cli.mjs inspect <take-id> --from <ms> --to <ms> [--crop x,y,w,h]`.
4. **Look at the pixels.** Pass a printed `sheets[].path` verbatim to the
   `motion_view` tool to confirm what the numbers suggest. Long windows are
   split across several sheets automatically; view the ones covering your
   moment. Never describe an image you have not viewed with `motion_view`.
   Images last one turn; call `motion_view` again in later turns.
5. **Relate it to the code**, edit the app, then capture new takes of the same
   scenario (`--label after`) and compare:
   `node /root/workspace/motion/cli.mjs compare --before <id,id,id> --after <id,id,id> --from <ms> --to <ms>`.
   View every compare sheet with `motion_view`. Compare reports change, not
   quality: you judge whether the requested behavior is now right.

## Evidence rules

- A defect can last a single display frame (~16.7 ms). View every frame in the
  window, not a sample, and use several takes; one clean take proves nothing.
- Table times are exact page frame times. Sheet times are capture times, about
  9–28 ms after the paint they show, so cite both honestly.
- Report every take, including ones where the defect did not appear, and any
  compare warnings. Frame rate is not proof of smoothness.
- Cite the take ID, table row times and the sheet frames (`#N`) you viewed.
- Attach the key sheets (PNG) to your reply with the `attach` tool so the user
  sees them inline.

## Case record (last step)

Write one case after the investigation:
`gbrain put cases/motion-<first-before-take-id> --content '<markdown>'` with the
request, scenario name, app revision before and after, take IDs, observed
intervals (ms from trigger), diagnosis, change made, per-take before/after
result, sheet paths, and a unique token. Verify with
`gbrain get cases/motion-<first-before-take-id>` and `gbrain search '<token>'`.
Write only under `cases/`. If GBrain fails, say so plainly in the reply; it
never stops capture, inspection or the report.
