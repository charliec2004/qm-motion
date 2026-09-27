# Implementation spec

This doc owns the **exact contracts**: file formats, command flags, outputs,
errors and test procedures. [architecture.md](architecture.md) explains why;
[plan.md](plan.md) orders the work. Terms are defined in
[brief.md](brief.md#terms). Everything here is proposed until built.

Choices marked **Decision** were made on September 27 to remove ambiguity.
Change them here first if needed.

**Text first, image to confirm.** Every look at a take gives the agent a short
numeric table of the watched elements (from the trace) and one sheet. The
table is cheap and exact; the sheet shows what the numbers cannot, such as
clipping or overlap. In the spike, a per-frame trace of the panel's height
exposed the rebound in every logged run.

## 1. `motion_view` (QM core patch)

**File:** `deployment/runtime/patches/motion-evidence-image.patch`.

**Base.** The running core's `/app/src` already contains both existing
patches, which touch `config.ts` and `pi-harness.ts`. Ours touches only
`src/tools/primitives.ts` and `src/harness/agent-tools.ts`, so it applies
cleanly after them. Make it by copying those two files out of
`qm-qm-motion-core`, editing, and diffing with `a/` and `b/` prefixes rooted
at `/app`.

**`ToolContext.readBytes`** (optional method):
`readBytes(path: string, signal?: AbortSignal): Promise<Uint8Array | null>`.
It provisions the handle, then `deps.sandbox.readFileBytes(handle, path)`,
relative to `/root/workspace`. It has no skill, shared-file or memory
branches.

**Tool `motion_view`.**

- **Parameters:** `{ path: string }`.
- **Description** (seen by the model): "Show one QM Motion evidence image
  (a sheet under artifacts/motion/) to yourself as an image. Use after motion
  inspect or compare."
- **Accepts** only paths matching
  `^artifacts/motion/[A-Za-z0-9._-]+/([A-Za-z0-9._-]+/)*[A-Za-z0-9._-]+\.(png|jpe?g|webp)$`,
  with no `..` segment.
- **Validates,** in order:
  1. the path matches;
  2. the file exists;
  3. the magic bytes are PNG, JPEG or WebP and agree with the extension;
  4. the size is at most 4.5 MB;
  5. the header dimensions are at most 2000×2000. Read them from the file
     header: for PNG, the IHDR width and height (big-endian, bytes 16–23);
     for JPEG, the first SOF0 or SOF2 marker; for WebP, the VP8X, VP8 or VP8L
     chunk.
- **Success result:** one text block,
  `motion_view <path> <w>x<h> <bytes> bytes sha256=<hex>`, followed by one
  `{type:"image", data:<base64>, mimeType}` block.
- **Failure result:** a single text block starting `[motion_view error]` that
  names the failed check, returned through `recordResult` with
  `isError: true`.
- **Logging:** the `recordResult` summary is
  `{tool:"motion_view", path, bytes, sha256, width, height}`, with no bytes.
- **Registration:** add it to the `tools` list in `createAgentTools`.
  Everything else stays unchanged.
- **Syntax:** use only erasable TypeScript (Node type stripping).

**Deploy:** `npm start`. Then confirm that
`docker exec qm-qm-motion-core grep -n motion_view /app/src/harness/agent-tools.ts`
finds the tool and `npm run status` is healthy.

## 2. Running real turns

"Real turn" means `node scripts/qm-turn.mjs`. That calls QM's `/api/turn`
with `gpt-6-sol` and `pi`, and saves the run to
`artifacts/smoke/run-<id>.json`. Add two flags:

- `--thread <name>`: sets `threadRef` to
  `web:charlieconner04@gmail.com:<name>`. Verified in code on September 27:
  the web server forwards a `threadRef` starting with `web:`, and core
  continues the existing session with that name (`sessions.getByThread`,
  `src/api/app-turn.ts:181`) or starts a new one. Without a name, every turn
  goes to one shared conversation, `web:<user>:default`, so tests must always
  pass `--thread`.
- `--timeout <seconds>`: replaces the 240-second abort (default stays 240).
  QM itself has no turn limit (`turnWallClockSec: 0`). A single `execute`
  command is capped at 120s by default and 300s at most.

Verify outcomes from the saved run JSON and independent reads through
`npm run computer`, never from the agent's words alone.

**The app server during real turns.** When a turn ends, QM stops the computer
unless the agent owns a `background` job, which kills a server started with
`npm run demo`. So:

- **Operator-only work** (milestones 2–3 development, running the CLI through
  `npm run computer`): use `npm run demo`.
- **Real turns that need the app:** first run `npm run demo -- stop` on the
  host, then have the agent start the server with QM's `background` tool.
  The exact call is in [demo.md](demo.md#hand-the-server-to-qm).

## 3. Development loop for the `motion` CLI

- **Source:** `src/motion/`.
  - `cli.mjs` is the entry point (`capture | inspect | compare`).
  - The command modules sit alongside it.
  - `scenarios/field-notes-close.json` is the one scenario.
- **Copy into the computer:**
  `tar -C src -c motion | python3 scripts/computer.py tar -x -C /root/workspace`.
- **Run:** `node /root/workspace/motion/cli.mjs <command> …`. The guidance
  skill calls it `motion` for short.
- **Playwright:** reuse the spike's proven code
  (`artifacts/motion-spike/scripts/pw-alt.mjs`):
  `const { chromium } = createRequire('/opt/qm-motion/package.json')('playwright')`,
  then `chromium.launch({ executablePath: '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox'] })`, `browser.newPage({ viewport, deviceScaleFactor,
  reducedMotion })`, and `page.context().newCDPSession(page)` for the
  screencast. ES module imports do not search `/opt/qm-motion/node_modules`,
  and `NODE_PATH` does not apply to them.
- **Why not QM's tool layer:** `deployment/sandbox/tools/<id>/tool.json` can
  declare install files, but core only installs them on remote backends. The
  local Docker backend (`local-sandbox.ts`) ignores them; GBrain is in the
  computer only because our Dockerfile copies it. Copy the CLI into
  `/root/workspace` instead.
- **FFmpeg** is on `PATH` in the computer.
- **Output:** every command prints exactly one JSON object to stdout. On
  failure it prints `{"ok":false,"error":"…"}` and exits 1. Progress goes to
  stderr.

## 4. Scenario file

A scenario is JSON data; the CLI contains no target-specific logic.

```json
{
  "name": "field-notes-close",
  "url": "http://localhost:4173/",
  "appDir": "/root/workspace/qm-motion-demo/current",
  "viewport": { "width": 960, "height": 720 },
  "deviceScaleFactor": 1,
  "reducedMotion": "no-preference",
  "ready": { "selector": ".faq .item:nth-child(1) .content[data-state='open']", "settleMs": 350 },
  "trigger": { "action": "click", "role": "button", "name": "What comes with a Field Notes membership?", "exact": true },
  "watch": [
    { "name": "first-answer", "selector": ".faq .item:nth-child(1) .content", "attributes": ["data-state"] },
    { "name": "second-question", "selector": ".faq .item:nth-child(2) .header" }
  ],
  "recordBeforeMs": 300,
  "recordAfterMs": 800
}
```

Locators come from `demo/src/main.jsx`. Every question is a Radix item with
the classes `.item`, `.header`, `.trigger` and `.content`, and the first
answer starts open (`defaultValue="question-0"`). `ready` is a CSS selector
that must be visible. `trigger` uses Playwright's `getByRole`; the `+` symbol
is `aria-hidden`, so the accessible name is exactly the question text, as the
spike used. `watch` lists 1–5 elements, each with a name, a CSS selector and
optional extra `attributes` to record. It names *where to look*, not what is
wrong. `appDir` provides the app revision.

## 5. `motion capture`

`motion capture --scenario <file> --label <before|after|text> [--takes N]`
(default 1 take; compare needs 3 or more per side).

**Decision:** each take gets a new Chromium process and a new browser
context, then a fresh navigation. Nothing persists between takes. The app's
source is *not* reset between takes; that is the agent's choice.

**Per take:**

1. Fail fast with a clear error if `url` does not respond.
2. Launch `/usr/bin/chromium` through Playwright, apply the viewport, scale
   factor and reduced-motion setting, and navigate.
3. Wait for `ready`, then `settleMs`.
4. Install a capture-phase listener for the trigger event. It records
   `event.timeStamp` (page clock) and `performance.timeOrigin +
   event.timeStamp` (wall-clock ms).
5. Install the **trace sampler**: a `requestAnimationFrame` loop that, every
   frame, records the rAF timestamp and, for each watched element,
   `getBoundingClientRect()` (x, y, width, height), computed `opacity`,
   `display` and `visibility`, the `hidden` attribute, any listed extra
   `attributes`, and whether it is still in the document. Animations are updated before rAF callbacks, so
   each sample is the state about to be painted in that frame. This is
   instrumentation: reading layout every frame has a cost. In the spike, the
   same kind of sampler did not stop the defect reproducing.
6. Start `Page.startScreencast` (`format: "jpeg"`, `quality: 80`,
   `everyNthFrame: 1`) and acknowledge every frame. Wait `recordBeforeMs`.
7. Perform the trigger with Playwright's locator.
8. Wait `recordAfterMs`, then stop the screencast and the sampler, and read
   the samples back.

**Run ID:** `<UTC yyyymmddTHHMMSS>-<label>-<takeIndex>-<4 hex>`.

**Directory** `/root/workspace/artifacts/motion/<run-id>/`:

- `frames/000001.jpg` and onwards: the screencast frames.
- `frames.json`: an array of
  `{ "file", "chromeTimestampS", "msFromTrigger" }`. `chromeTimestampS` is
  the screencast `metadata.timestamp`; `msFromTrigger` is
  `chromeTimestampS*1000 − triggerWallMs`, rounded to 0.1.
- `trace.json`: an array of samples
  `{ "msFromTrigger", "elements": { "<name>": { "x", "y", "width", "height",
  "opacity", "display", "visibility", "hidden", "connected", "attributes" } } }`, where
  `msFromTrigger = rafTimestamp − trigger event.timeStamp` (same page clock,
  so exact to the frame). A watched element that is missing is recorded as
  `null`.
- `manifest.json`: see below.

**`manifest.json`:** `runId`, `label`, `take`, the scenario (inline copy),
`browser` (`browser.version()`), `playwrightVersion`, the viewport and scale
factor, `app` (`git -C appDir rev-parse HEAD`, plus the SHA-256 of
`git -C appDir diff HEAD` output), `trigger.wallMs`, `frameCount`,
`traceSampleCount`, `sampler: "rAF getBoundingClientRect + computed style"`,
`timingSource` (`"CDP screencast metadata.timestamp; frames arrive ~9–28ms
after the page state they show"`), `startedAt`, and a SHA-256 for each file.

**stdout:**
`{"ok":true,"runs":[{"runId","dir","frameCount","traceSampleCount","triggerFound":true}]}`.
If the trigger listener never fires, the take is kept but reported with
`"triggerFound": false` and `ok: false`.

## 6. `motion inspect`

`motion inspect <run-id> --from <ms> --to <ms> [--crop x,y,w,h]`, with times
in ms from the trigger and the crop in CSS pixels (equal to image pixels at
scale 1).

- **Table (always):** from `trace.json`, one row per sample in the window
  where any watched value changed (≥ 0.5 px, or any change in opacity,
  display, visibility, hidden or connected), plus the first and last rows.
  Values are rounded to 0.01. It is capped at 60 rows; beyond that it asks
  for a narrower window. Shape, with real values from spike take
  `ab/rec60-marker-1` (last rows of the close):

  ```
  ms      first-answer h   first-answer hidden   second-question y
  +230.1  2.25             false                 363.75
  +246.8  0.59             false                 362.09
  +263.5  76.78            false                 438.28
  +280.1  0.00             true                  361.50
  ```
- **Frames:** selects *every* screencast frame with
  `from ≤ msFromTrigger ≤ to`. **Decision:** it never samples. If there are
  more than 24, it skips the sheet and says "window has N frames; narrow it or
  crop"; the table is still returned. It fails if `from ≥ to` or the crop is
  out of bounds.
- **Layout (Decision):** 4 columns and tiles 400 px wide, with height from
  the crop's aspect ratio. So 24 frames make 6 rows, with a 4 px white gap.
  Each tile is labelled `+264.3 ms #12` in its top-left corner.
- **FFmpeg recipe** (verified in the computer on September 27):
  1. For each frame:
     `ffmpeg -i <frame>.jpg -vf "crop=w:h:x:y,scale=400:-2,drawtext=fontfile=/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf:text='<label>':fontsize=22:fontcolor=white:box=1:boxcolor=black@0.7:x=6:y=6" tile_NNN.png`.
  2. Then `ffmpeg -framerate 1 -i tile_%03d.png -vf "tile=4xR:padding=4:color=white" -frames:v 1 sheet.png`.

  Labels contain no `:` or `'`.
- **Output:** writes `sheets/inspect_<from>_<to>[_crop].png` inside the run
  directory, targeting about 1 MB. If it is over 4.5 MB or 2000 px, it fails.
- **stdout:** `{"ok":true,"table":"<text>","sheet":"artifacts/motion/<run>/sheets/…png" | null,"sheetSkippedReason":null | "<text>","frames":N,"width","height","bytes"}`.

## 7. `motion compare`

`motion compare --before <id,id,…> --after <id,id,…> --from <ms> --to <ms>
[--crop x,y,w,h]`.

- **Checks:** refuses runs whose scenario name, URL, viewport, scale factor,
  reduced-motion setting or browser version differ, naming the difference.
  It warns, without refusing, when app revisions are equal across before
  and after.
- **Layout.** **Decision:** one row per take, before rows first, each row
  labelled `before take 1`, `after take 2` and so on. Each row shows *every*
  frame of that take in the window, left to right, with its own label.
  Columns are not forced to line up, because takes deliver frames at
  different times and forcing a grid would drop or repeat frames.
- **Size (Decision):** tiles are 240 px wide, with at most 8 frames per row
  and 8 rows (for example 4 before and 4 after), so the sheet stays under 2000
  px. It fails if a row would have more than 8 frames ("narrow the window"),
  or if the sheet exceeds the size limits. The same crop applies to all rows,
  and each row starts with a label tile such as `before 1`.
- **Tables:** prints the section 6 table for every take, labelled like the
  sheet rows, so values can be compared take by take.
- **Output:** writes `artifacts/motion/compare-<UTC>-<4 hex>/sheet.png` and a
  `compare.json` listing its inputs, per-row frame counts and the tables.
- **What it does not do:** it never states whether the defect is present, and
  it applies no thresholds or "jump" flags; the agent judges each take.

## 7a. Chrome animation details (optional; cut early)

If time allows, `motion capture` also enables the CDP `Animation` domain
before the trigger. It records each `animationStarted` event's name, type
(CSS animation, CSS transition or Web Animation), duration, delay, easing
and target node, and writes them to `animations.json`. `motion inspect`
then lists them above the table. This helps connect what the agent saw to
the code that ran. It never pauses or seeks anything.

## 8. Agent guidance (`deployment/sandbox/skills/motion-workflow/SKILL.md`)

Rewrite it when the CLI exists. It must say, briefly:

1. For motion problems, capture takes and inspect a narrow window around the
   trigger. Read the table first, then call `motion_view` on the sheet to
   confirm what the numbers suggest. Never describe an image you have not
   viewed.
2. The exact command syntax from sections 5–7, and where scenarios live.
3. The rebound-style lesson: a defect can last a single frame, so view every
   frame in the window and take several takes.
4. Table times are exact page frame times. Sheet frame times are capture
   times, about 9–28ms after the paint they show.
5. After editing, repeat with three or more takes and use `motion compare`;
   report every take, including ones where the defect did not appear.
6. Images last one turn; call `motion_view` again in later turns.
7. Write the case (section 9) last; a GBrain failure is reported and never
   stops the investigation.

It must not mention Field Notes' cause or any fix.

**Deploying it (verified from the CLI and database, September 27):**
`npm start` runs `qm up`, which sends `deployment/sandbox/skills/` to core
with `PUT /v1/deployment-layer`. It is stored in the `deployment_layer` table
(currently version 4, written by "source-authenticated deployment CLI"), and
core applies it within 30 seconds, without a restart. Confirm with a real turn
that reads `skill://motion-workflow/SKILL.md` and quotes a new line.

## 9. GBrain case

`gbrain put cases/motion-<first-before-run-id> --content '<markdown>'`
containing: request, scenario name, app revision before and after, run IDs,
observed intervals (ms from trigger), diagnosis, change made, per-take
before/after result, sheet paths, and a unique token for retrieval tests.
Verify with `gbrain get` and `gbrain search '<token>'`.

## 10. Tests

Keep them few and meaningful.

**Milestone 1, all real turns:**

1. With `npm run computer`, create
   `artifacts/motion/selftest/code.png` containing a random six-digit code,
   using FFmpeg `drawtext`. The code must never appear in the prompt, the
   filename or any text file.
2. On a new thread, ask the agent to call `motion_view` on the image and
   report the code. Pass if the reply matches.
3. On the same thread, a second turn asks what the code was without calling
   tools. Expect it cannot see the image, which confirms images last one
   turn. Report the result either way.
4. On one turn, ask for `motion_view` on four paths: a missing file, a 2400 px
   wide PNG, `../qm-computer-proof.txt`, and a `.png` containing text. Pass
   if the run JSON shows four `[motion_view error]` results naming the right
   checks.

**CLI:** `node --test` covers only the pure functions: path and window
validation, frame and row selection, and `msFromTrigger`. Everything else is
proven by real takes in the computer. Tool check for milestone 2, for us, not
the agent: three Field Notes takes whose `trace.json` shows the one-frame
reopen measured in the spike. This validates capture, not a diagnosis.
