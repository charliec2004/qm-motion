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
relative to `/root/workspace`, and returns `null` for a missing file. It has no
skill, shared-file or memory branches.

**Tool `motion_view`.**

- **Parameters:** `{ path: string }`.
- **Description** (seen by the model): "Show one QM Motion evidence image
  (a sheet under artifacts/motion/) to yourself as an image. Use after motion
  inspect or compare."
- **Accepts** only PNG paths matching
  `^artifacts/motion/[A-Za-z0-9._-]+/([A-Za-z0-9._-]+/)*[A-Za-z0-9._-]+\.png$`,
  with no `..` segment. **Decision:** PNG only, because every sheet we make
  is PNG. To see a single frame, inspect a one-frame window.
- **Validates,** in order:
  1. the path matches;
  2. the file exists;
  3. the first 8 bytes are the PNG signature;
  4. the size is at most 4,718,592 bytes (4.5 MiB, pi's own read-tool
     limit);
  5. the IHDR width and height (big-endian, bytes 16–23) are at most
     2000×2000.
- **Success result:** one text block,
  `motion_view <path> <w>x<h> <bytes> bytes sha256=<hex>`, followed by one
  `{type:"image", data:<base64>, mimeType:"image/png"}` block.
- **Failure result:** a single text block starting `[motion_view error]` that
  names the failed check, returned through `recordResult` with
  `isError: true`.
- **Logging:** the `recordResult` summary is
  `{tool:"motion_view", path, bytes, sha256, width, height}` on success and
  `{tool:"motion_view", path, error}` on failure, never image bytes.
- **Registration:** add it to the `tools` list in `createAgentTools`.
  Everything else stays unchanged.
- **Syntax:** use only erasable TypeScript (Node type stripping).

**Deploy:** `npm start`, from the primary checkout (see
[plan.md](plan.md#how-to-work-hackathon-rules)). Then confirm that
`docker exec qm-qm-motion-core grep -n motion_view /app/src/harness/agent-tools.ts`
finds the tool and `npm run status` is healthy. If `npm run demo -- status`
shows the demo server stopped, run `npm run demo` again.

## 2. Running real turns

A **real turn** is an actual QM conversation turn with GPT-6 Sol, sent with
`node scripts/qm-turn.mjs` (or typed in the web UI for the demo). The script
calls QM's `/api/turn` with `gpt-6-sol`, `pi` and `thinkingLevel: "low"` (as
`scripts/smoke-agent.mjs` does), and saves QM's run record to
`artifacts/smoke/run-<id>.json` on the host. Add two flags to `qm-turn.mjs`:

- `--thread <name>`: sets `threadRef` to
  `web:charlieconner04@gmail.com:<name>`. Verified in code on September 27:
  the web server forwards a `threadRef` starting with `web:`, and core
  continues the existing session with that name (`sessions.getByThread`,
  `src/api/app-turn.ts:181`) or starts a new one. Without a name, every turn
  goes to one shared conversation, `web:<user>:default`, so tests must always
  pass `--thread`.
- `--timeout <seconds>`: replaces the 240-second abort. The 240 is hard-coded
  in `turn()` in `scripts/qm-session.mjs` (lines 45 and 60), so add a
  `timeoutMs` option there, defaulting to 240000 so smoke is unchanged.
  QM itself has no turn limit (`turnWallClockSec: 0`). A single `execute`
  command is capped at 120s by default and 300s at most.

Verify outcomes from the saved run JSON and independent reads through
`npm run computer`, never from the agent's words alone.

**The app server during real turns.** When a turn ends, QM stops the computer
unless the agent owns a `background` job, which kills a server started with
`npm run demo`. So:

- **Operator-only work** (milestones 2–4, running the CLI through
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
  and `NODE_PATH` does not apply to them. The screencast loop that caught the
  rebound 7 of 7 times:

  ```js
  cdp.on('Page.screencastFrame', async f => {
    frames.push({ data: f.data, ts: f.metadata.timestamp }); // write JPEG + timestamp
    try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch {}
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 80, everyNthFrame: 1,
    maxWidth: viewport.width, maxHeight: viewport.height });
  // … trigger, wait …
  await cdp.send('Page.stopScreencast');
  ```
- **Why not QM's tool layer:** `deployment/sandbox/tools/<id>/tool.json` can
  declare install files, but core only installs them on remote backends. The
  local Docker backend (`local-sandbox.ts`) ignores them; GBrain is in the
  computer only because our Dockerfile copies it. Copy the CLI into
  `/root/workspace` instead.
- **FFmpeg** is on `PATH` in the computer.
- **Output:** every command prints exactly one JSON object to stdout and
  exits 0 when `ok` is true. On any failure it prints an object with
  `"ok":false` and an `"error"` string (plus any partial results) and exits
  1. Progress goes to stderr.
- **Name:** docs write `motion capture` and so on. The actual command is
  `node /root/workspace/motion/cli.mjs capture …`; there is no `motion`
  executable unless the CLI is later baked into the sandbox image.

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

`motion capture --scenario <file> --label <label> [--takes N]`. The label
matches `[a-z0-9-]{1,16}`; use `before` and `after` for takes you will
compare. The default is 1 take; compare needs 3 or more per side. Each take is
about 1.1 s (`recordBeforeMs` + `recordAfterMs`), which covers the 250 ms close
with margin. Longer is not better here.

**Decision:** each take is a **fresh take**: a new Chromium process, a new
browser context and a fresh navigation. Nothing persists between takes. This
is not a source reset (`npm run demo -- reset`); after-takes run against the
agent's edited copy.

**Per take:**

1. Fail fast with a clear error if `url` does not respond.
2. Launch `/usr/bin/chromium` through Playwright, apply the viewport, scale
   factor and reduced-motion setting, and navigate.
3. Wait for `ready`, then `settleMs`.
4. Install a capture-phase `click` listener on `document`. The first click
   records `event.timeStamp` (page clock) and `performance.timeOrigin +
   event.timeStamp` (wall-clock ms).
5. Install the **trace sampler**: a `requestAnimationFrame` loop that, every
   frame, records the rAF timestamp and, for each watched element,
   re-queried with `document.querySelector(selector)` every frame:
   `getBoundingClientRect()` (x, y, width, height), computed `opacity`,
   `display` and `visibility`, the `hidden` attribute and any listed extra
   `attributes`. If the selector matches nothing, the element is `null` for
   that sample. Animations are updated before rAF callbacks, so
   each sample is the state about to be painted in that frame. This is
   instrumentation: reading layout every frame has a cost. In the spike, the
   same kind of sampler did not stop the defect reproducing.
6. Start `Page.startScreencast` (`format: "jpeg"`, `quality: 80`,
   `everyNthFrame: 1`) and acknowledge every frame. Wait `recordBeforeMs`.
7. Perform the trigger with Playwright's locator.
8. Wait `recordAfterMs`, then stop the screencast and the sampler, and read
   the samples back.

**Take ID:** `<UTC yyyymmddTHHMMSS>-<label>-<n>-<4 hex>`, where `n` is 1, 2, 3
and so on within one command.

**Directory** (in the computer) `/root/workspace/artifacts/motion/<take-id>/`:

- `frames/000001.jpg` and onwards: the screencast frames.
- `frames.json`: an array of
  `{ "file", "chromeTimestampS", "msFromTrigger" }`. `chromeTimestampS` is
  the screencast `metadata.timestamp`; `msFromTrigger` is
  `chromeTimestampS*1000 − triggerWallMs`, rounded to 0.1.
- `trace.json`: an array of samples
  `{ "msFromTrigger", "elements": { "<name>": { "x", "y", "width", "height",
  "opacity", "display", "visibility", "hidden", "attributes" } | null } }`, where
  `msFromTrigger = rafTimestamp − trigger event.timeStamp` (same page clock,
  so exact to the frame).
- `manifest.json`: see below.

**`manifest.json`:** `takeId`, `label`, `n`, the scenario (inline copy: URL,
viewport, ready state, trigger and watched elements), `reset: "fresh take:
new Chromium process, new context, fresh navigation"`,
`browser` (`browser.version()`), `playwrightVersion`, the viewport and scale
factor, `app` (`git -C appDir rev-parse HEAD`, the SHA-256 of
`git -C appDir diff HEAD`, and `git -C appDir status --porcelain` so new
untracked files show; all `null` if `appDir` is not a Git repository), `trigger.wallMs`, `frameCount`,
`traceSampleCount`, `sampler: "rAF getBoundingClientRect + computed style"`,
`timingSource` (`"CDP screencast metadata.timestamp; frames arrive ~9–28ms
after the page state they show"`) and `startedAt`. No per-file hashes.

**stdout:**
`{"ok":true,"takes":[{"takeId","dir","frameCount","traceSampleCount","triggerFound":true}]}`.
If the click listener never fires in a take, that take is kept with
`"triggerFound": false` and `msFromTrigger` values of `null`. The command
then returns `ok: false` with an `error` naming the take, and exits 1.

## 6. `motion inspect`

`motion inspect <take-id> --from <ms> --to <ms> [--crop x,y,w,h]`, with times
in ms from the trigger and the crop in CSS pixels (equal to image pixels at
scale 1).

- **Table (always):** from `trace.json`, one row per sample in the window
  where any watched value differs from the *previous sample* (≥ 0.5 px for
  x, y, width and height; any change in opacity, display, visibility, hidden,
  a listed attribute, or an element becoming `null` or reappearing), plus the
  first and last rows.
  Values are rounded to 0.01. **Columns:** one per watched field that changes
  anywhere in the window, named `<element> <field>` with the trace.json field
  names (for example `first-answer height`), so unchanging fields are left
  out. It is capped at 60 rows; beyond that it asks for a narrower
  window. Shape, with real values from spike take
  `ab/rec60-marker-1` (last rows of the close):

  ```
  ms      first-answer height   first-answer hidden   second-question y
  +230.1  2.25             false                 363.75
  +246.8  0.59             false                 362.09
  +263.5  76.78            false                 438.28
  +280.1  0.00             true                  361.50
  ```
- **Frames:** selects *every* screencast frame with
  `from ≤ msFromTrigger ≤ to + 30`. The extra 30 ms is there because a frame
  arrives about 9–28 ms after the page state it shows, so a window chosen
  from the table still includes the frame showing its last row.
  **Decision:** it never samples. If there are
  more than 24, it skips the sheet and says "window has N frames; narrow it or
  crop"; the table is still returned. If the window has no frames, the table
  is returned with no sheet. It fails if `from ≥ to`, the crop is out of
  bounds, or the take has no trace samples.
- **Layout (Decision):** 4 columns and tiles 400 px wide, with height from
  the crop's aspect ratio. So 24 frames make 6 rows, with a 4 px white gap.
  Each tile is labelled `+264.3 ms #12` in its top-left corner, where `#12` is
  the frame's file number in the take (`frames/000012.jpg`).
- **FFmpeg recipe** (verified in the computer on September 27):
  1. For each frame:
     `ffmpeg -i <frame>.jpg -vf "crop=w:h:x:y,scale=400:-2,drawtext=fontfile=/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf:text='<label>':fontsize=22:fontcolor=white:box=1:boxcolor=black@0.7:x=6:y=6" tile_NNN.png`.
  2. Then `ffmpeg -framerate 1 -i tile_%03d.png -vf "tile=4xR:padding=4:color=white" -frames:v 1 sheet.png`.

  Labels contain no `:` or `'`.
- **Output:** writes `sheets/inspect_<from>_<to>_<crop>.png` inside the take
  directory, where `<crop>` is `x-y-w-h` or `full`. Sheets of UI frames are
  usually well under 1 MB. If one exceeds `motion_view`'s limits (4.5 MiB or
  2000 px), it fails; crop or narrow the window.
- **stdout:** `{"ok":true,"table":"<text>","sheet":"artifacts/motion/<take-id>/sheets/…png" | null,"sheetSkippedReason":null | "<text>","frames":N,"width","height","bytes"}`; the last three are `null` when there is no sheet.

## 7. `motion compare`

`motion compare --before <take-id,…> --after <take-id,…> --from <ms> --to <ms>
[--crop x,y,w,h]`. Frames are selected as in section 6.

- **Checks:** refuses takes whose scenario name, URL, viewport, scale factor,
  reduced-motion setting or browser version differ, naming the difference.
  It warns, without refusing, when app revisions are equal across before
  and after.
- **Layout.** **Decision:** one row per take, before rows first, each row
  labelled `before 1`, `after 2` and so on. Each row shows *every*
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

Rewrite it in milestone 5, replacing the current text entirely. That text
still says the motion commands don't exist and suggests `agent-browser
record`, which is fine until then. It must say, briefly:

1. For motion problems, capture takes and inspect a narrow window around the
   trigger. Read the table first, then call `motion_view` on the sheet to
   confirm what the numbers suggest. Never describe an image you have not
   viewed.
2. The exact commands from sections 5–7, written out in full
   (`node /root/workspace/motion/cli.mjs capture --scenario
   /root/workspace/motion/scenarios/field-notes-close.json --label before
   --takes 3`, and so on), and that sheets are viewed with `motion_view`.
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
(written by "source-authenticated deployment CLI"), and
core applies it within 30 seconds, without a restart. Confirm with a real turn
that reads `skill://motion-workflow/SKILL.md` and quotes a new line.

## 9. GBrain case

`gbrain put cases/motion-<first-before-take-id> --content '<markdown>'`
containing: request, scenario name, app revision before and after, take IDs,
observed intervals (ms from trigger), diagnosis, change made, per-take
before/after result, sheet paths, and a unique token for retrieval tests.
Verify with `gbrain get` and `gbrain search '<token>'`.

## 10. Tests

Only these checks are required. Do not add others.

**Milestone 1 (the only test-only real turn):**

1. **Setup.** Pick a random six-digit code on the host and render it inside
   the computer. Pass it on the command line, never in a file:
   `npm run computer -- sh -c "mkdir -p artifacts/motion/selftest && ffmpeg -v error -y -f lavfi -i color=c=white:s=480x160 -vf drawtext=fontfile=/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf:text=<CODE>:fontsize=96:x=40:y=30 -frames:v 1 artifacts/motion/selftest/code.png"`.
2. **Pass check.** Run `node scripts/qm-turn.mjs --thread mv-<timestamp> "Call
   motion_view on artifacts/motion/selftest/code.png and reply with only the
   number in the image."` It passes if the reply equals the code.

The error paths (bad path, missing file, size) are simple enough to trust from
reading the code. Do not spend turns testing them.

**Milestones 2–4:** run the commands directly in the computer, as the plan's
"done when" says. No QM turns.

**Milestone 5, the real investigation** (after the skill is deployed and the
server handed to the agent). Send the user's request exactly, with no hints:

> When I close the first FAQ, the page seems to blink or jump at the end.
> Reproduce it, inspect the motion, and fix it while keeping the close
> animation and accessible interaction.

Tool success, checked by us from the reply and the take files: the agent's
description matches the trace, namely the first answer collapsing, then
reappearing for one sample around +250–285 ms, then hiding. It also cites a
frame or sample it actually viewed. The fix is a demo goal, not a pass
condition.

**Milestone 6:** the rehearsal runs are the tests. Do not add others.

Unit tests are optional; skip them if time is short. If written, they cover
only pure functions, live in `src/motion/*.test.mjs`, and run on the host
with `node --test src/motion`.
