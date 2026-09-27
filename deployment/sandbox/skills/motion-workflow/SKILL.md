---
name: motion-workflow
description: Investigate and fix things that go wrong on screen over time in a local web app (blink, jump, flicker, flash, glitch, layout shift, animation, transition) by recording the interaction frame by frame, reading per-frame measurements, viewing frame sheets, and comparing before/after takes, then showing the user a before/after video.
---

Use the `motion` CLI in this computer. It is `node /root/workspace/motion/cli.mjs`;
run it with `execute`. `node /root/workspace/motion/cli.mjs help` shows every
option. Every command prints one JSON object with a `next` hint.

## Loop

1. **Write a scenario** for the interaction: a JSON file anywhere under
   `/root/workspace` (format: `node /root/workspace/motion/cli.mjs help scenario`).
   `watch` names *where to look* (the elements that move, appear or disappear);
   their size, position and visibility are traced every display frame. Set
   `appDir` to the app's Git working copy so each take records its revision.
   The app server must already be running (start it with the `background` tool).
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
   quality: you judge whether the requested behavior is now right. Compare
   also makes the user's video from the first before and first after take:
   real speed, then slow motion over `--from`/`--to`, cropped by `--crop`
   (crop to the region that matters so it is readable).

## Evidence rules

- A defect can last a single display frame (~16.7 ms). View every frame in the
  window, not a sample, and use several takes; one clean take proves nothing.
- Table times are exact page frame times. Sheet times are capture times, about
  9–28 ms after the paint they show, so cite both honestly.
- Report every take, including ones where the defect did not appear, and any
  compare warnings. Frame rate is not proof of smoothness.
- Cite the take ID, table row times and the sheet frames (`#N`) you viewed.

## Reply to the user

Tables and sheets are your evidence; the user gets the video. Attach the two
`video.attach` files from your final compare (the one whose after takes hold
the change you kept): `player.html` plays inline in chat, the MP4 downloads.
The video has no annotations, so say in your reply where to look (for example
"in BEFORE, watch the menu at about +120 ms"). You cannot see
the video: describe only what the table and the sheets you viewed show. Do not
attach sheets unless the user asks for them.

## Case record (last step)

Write one case after the investigation. GBrain lowercases slugs, so lowercase
the take ID: `gbrain put cases/motion-<first-before-take-id, lowercased> --content '<markdown>'` with the
request, scenario name, app revision before and after, take IDs, observed
intervals (ms from trigger), diagnosis, change made, per-take before/after
result, sheet paths, and a unique token. Verify with
`gbrain get` on that same lowercase slug and `gbrain search '<token>'`.
Write only under `cases/`. If GBrain fails, say so plainly in the reply; it
never stops capture, inspection or the report.
