# Implementation spec

This doc owns the **exact contracts**: file formats, command flags, outputs,
errors and test procedures. [architecture.md](architecture.md) explains why;
[plan.md](plan.md) orders the work. Terms are defined in
[brief.md](brief.md#terms). Everything here is proposed until built.

Choices marked **Decision** were made on September 27 to remove ambiguity.
Change them here first if needed.

**Text first, image to confirm.** Every look at a take gives the agent a short
numeric table of the watched elements (from the trace) and its sheets
(split automatically; view the one covering your moment). The
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

- **Parameters:** `{ path: string }`, with the parameter description: "Image
  path under /root/workspace, for example a `sheets[].path` value printed by
  motion inspect or compare."
- **Description** (seen by the model):

  > View an image file from your computer (PNG, JPEG, WebP or GIF) as an actual
  > image you can see; a file path or `read` gives you no pixels. Normally pass
  > a `sheets[].path` value printed by motion inspect or motion compare, after
  > reading that command's table. `path` is relative to /root/workspace; an
  > absolute /root/workspace/… path also works. Large images are shrunk
  > automatically, and the result says how coordinates map back. The image is
  > visible only for the rest of this turn; call again in later turns. Never
  > describe an image you have not viewed with this tool.
- **Accepts** `.png`, `.jpg`, `.jpeg`, `.webp` or `.gif` files under
  `/root/workspace`, given relative to it or as an absolute path starting
  `/root/workspace/` (that prefix is stripped). It rejects any `..` segment and
  any other absolute path. Evidence normally lives in `artifacts/motion/`, but
  screenshots the agent takes itself also work.
- **Never fails on image size (smart fallback).** The tool passes the bytes to pi's
  own `resizeImage` (the public export of `@earendil-works/pi-coding-agent`,
  which pi's read tool uses). With its defaults it returns an image of at
  most 2000×2000 px and 4.5 MiB, re-encoding as JPEG if needed.
  - Tested inside the running core on September 27: a 20 MB, 3000×2400 noise
    PNG, the worst case, became a 2000×1600 JPEG in about 3.7 s.
  - When the image was shrunk, `formatDimensionNote(result)` is appended to
    the text, for example "original 3000x2400, displayed at 2000x1600.
    Multiply coordinates by 1.50…".
- **Errors,** each naming the next step:
  1. `[motion_view error] path must be an image under /root/workspace (got …)`;
  2. `[motion_view error] not found: <path> (paths are relative to
     /root/workspace; copy a "sheets[].path" value from motion inspect)`;
  3. `[motion_view error] file is N MB; the limit for transfer is 50 MB, so
     crop it first`. This is a real limit: bytes cross from the computer to core
     as base64 JSON with a 120 s timeout;
  4. `[motion_view error] could not decode or shrink <path> (not a valid
     image?)`, when `resizeImage` throws or returns `null`. That is not
     expected in practice.
- **Success result:** one text block,
  `motion_view <path> <w>x<h> <mimeType> sha256=<hex of the file>` (plus the
  dimension note if shrunk), followed by one
  `{type:"image", data:<base64 from resizeImage>, mimeType:<its mimeType>}`
  block.
- **Failure result:** that single error text block, returned through
  `recordResult` with `isError: true`.
- **Logging:** the `recordResult` summary is
  `{tool:"motion_view", path, bytes, sha256, width, height, resized}` on
  success and `{tool:"motion_view", path, error}` on failure, never image
  bytes.
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
calls QM's `/api/turn` with `gpt-6-sol` and `pi`, and saves QM's run record to
`artifacts/smoke/run-<id>.json` on the host. Add two flags to `qm-turn.mjs`:

- Always pass `{ threadRef, thinkingLevel: "low" }` to `turn()`, as
  `scripts/smoke-agent.mjs` does; today `qm-turn.mjs` passes no options.
- `--thread <name>`: sets `threadRef` to
  `web:charlieconner04@gmail.com:<name>`. Verified in code on September 27:
  the web server forwards a `threadRef` starting with `web:`, and core
  continues the existing session with that name (`sessions.getByThread`,
  `src/api/app-turn.ts:181`) or starts a new one. Without a name, every turn
  goes to one shared conversation, `web:<user>:default`. So `--thread` is
  **required**: the script exits with a usage error without it.
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
  - `scenarios/field-notes-close.json` is **our test fixture** for milestones
    2–4. It is never given to the agent, because its watch list points at the
    defective panel. In real use the agent writes its own scenario
    (`cli.mjs help scenario`) anywhere under `/root/workspace`.
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
- **Arguments:** `--flag value` or `--flag=value`. Parse numbers yourself so
  negative values work (`--from -100`); Node's `util.parseArgs` rejects that
  form.
- **Output:** every command prints exactly one JSON object to stdout,
  pretty-printed with 2-space indentation so table rows land on separate
  lines. It exits 0 when `ok` is true. On any failure it prints `"ok":false`,
  an `"error"` string saying what to do next, and any partial results, then
  exits 1. Usage errors also include `"usage"`. Every success includes a
  `"next"` hint with the exact next command. Progress goes to stderr.
- **Help:** `cli.mjs help` prints plain-text usage (the one non-JSON output):

  ```
  usage: node /root/workspace/motion/cli.mjs <command> [options]
    capture --scenario <file.json> [--label <label>] [--takes 3] [--before-ms 300] [--after-ms 800]
        Fresh takes of one interaction; prints takeIds.
    inspect <take-id> [--from <ms>] [--to <ms>] [--crop x,y,w,h]
        Table of watched-element changes (read first) + sheets holding every
        frame in the window (split automatically; view the one covering your
        moment). Times are ms from the trigger; negatives allowed.
    compare --before <id,id,id> --after <id,id,id> [--from <ms>] [--to <ms>] [--crop x,y,w,h]
        One table per take + sheets with one row per take (split into
        time slices automatically).
    help scenario   annotated scenario format, to write one for any app
  View any printed sheets[].path with the motion_view tool.
  ```

  `cli.mjs help scenario` prints the section 4 format with one comment per
  field.
- **Name:** docs write `motion capture` and so on. The actual command is
  `node /root/workspace/motion/cli.mjs capture …`; there is no `motion`
  executable unless the CLI is later baked into the sandbox image.

## 4. Scenario file

A scenario is JSON data describing one interaction; the CLI contains no
target-specific logic. The agent can write one for any app. Invalid files fail
with an error naming the field.

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

| Field | Required | Meaning and default |
| --- | --- | --- |
| `name` | yes | Short identifier. |
| `url` | yes | Page to open inside the computer. |
| `trigger` | yes | `action`: `click`, `hover` or `press`. Target it with `role` + `name` (+ `exact`), through Playwright's `getByRole`, **or** with `selector` (CSS). `press` also needs `key` (for example `"Escape"`); without a target it presses on the page. |
| `appDir` | no | Git working copy used to record the app revision; default `null`. |
| `viewport`, `deviceScaleFactor`, `reducedMotion` | no | Defaults `960×720`, `1`, `"no-preference"`. |
| `ready` | no | `selector` (CSS) that must be visible before the take, plus `settleMs` (default 350). Without it: page load plus `settleMs`. |
| `setup` | no | Actions to run in order after `ready` and before recording, each shaped like `trigger` plus an optional `settleMs` (default 350) to wait afterwards. Use it to reach the starting state, for example `[{ "action": "click", "role": "button", "name": "Menu" }]` before a trigger that presses `Escape`. Setup is not recorded or timed. |
| `watch` | no | 0–10 elements, each `{name, selector, attributes?, styles?}`. The first element matching `selector` is traced. `attributes` adds DOM attributes; `styles` adds computed styles (for example `"transform"`, `"clip-path"`). It names *where to look*, not what is wrong. With no `watch`, `inspect` returns only sheets (no table). |
| `recordBeforeMs`, `recordAfterMs` | no | Defaults 300 and 800, and overridable per command. Total at most 10000. |

Field Notes locators come from `demo/src/main.jsx` and were validated on the
live page. Every question is a Radix item with the classes `.item`,
`.header`, `.trigger` and `.content`, and the first answer starts open
(`defaultValue="question-0"`). The `+` symbol is `aria-hidden`, so the
accessible name is exactly the question text.

## 5. `motion capture`

`motion capture --scenario <file> [--label <label>] [--takes N]
[--before-ms N] [--after-ms N]`.

- **Defaults:** `--takes 3` and `--label take`. The label is lowercased and
  slugified to `[a-z0-9-]{1,16}`; use `before` and `after` for takes you will
  compare.
- **Length:** the Field Notes take is about 1.1 s, which covers its 250 ms
  close with margin. Use `--after-ms` for longer animations, up to a total of
  10 s.

**Decision:** each take is a **fresh take**: a new Chromium process, a new
browser context and a fresh navigation. Nothing persists between takes. This
is not a source reset (`npm run demo -- reset`); after-takes run against the
agent's edited copy.

**Per take:**

1. Fail fast if `url` does not respond: `url … did not respond (ECONNREFUSED).
   Start the app server with the background tool, then retry.`
2. Launch `/usr/bin/chromium` through Playwright, apply the viewport, scale
   factor and reduced-motion setting, and navigate.
3. Wait for `ready` (10 s timeout; the error names the selector and suggests
   checking it against the page or editing `ready`), then `settleMs`. Then run
   each `setup` action with the same locator rules and 5 s timeout as the
   trigger, waiting its `settleMs` after each. A failing setup step is named
   in the error (`setup[1] … matched 0 elements`).
4. Install a capture-phase listener on `document` for the trigger's first
   event:
   - `pointerdown` for click, falling back to `click`;
   - `pointerover` for hover;
   - `keydown` for press.

   Record `event.type`, `event.timeStamp` (page clock) and
   `performance.timeOrigin + event.timeStamp` (wall-clock ms). The spike
   timed from `click`, and `pointerdown` came 1–4 ms earlier.
5. Install the **trace sampler**: a `requestAnimationFrame` loop that, every
   frame, records the rAF timestamp and, for each watched element,
   re-queried with `document.querySelector(selector)` every frame:
   `getBoundingClientRect()` (x, y, width, height), computed `opacity`,
   `display` and `visibility`, the `hidden` attribute, and any listed
   `attributes` and `styles`. If the selector matches nothing, the element is
   `null` for that sample.

   Animations are updated before rAF callbacks, so each sample is the state
   about to be painted in that frame. This is instrumentation: reading layout
   every frame has a cost. In the spike, the same kind of sampler did not
   stop the defect reproducing.
6. Start `Page.startScreencast` (`format: "jpeg"`, `quality: 80`,
   `everyNthFrame: 1`) and acknowledge every frame. Wait `recordBeforeMs`.
7. Perform the trigger through the locator, with a 5 s timeout. On a miss,
   the error lists up to 10 accessible names for that role (or the selector's
   match count) so the agent can fix the scenario.
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
  "opacity", "display", "visibility", "hidden", "attributes", "styles" } | null } }`,
  where `msFromTrigger = rafTimestamp − trigger event.timeStamp` (same page
  clock, so exact to the frame).
- `manifest.json`:
  - identity: `takeId`, `label`, `n`;
  - the scenario, as an inline copy;
  - `reset: "fresh take: new Chromium process, new context, fresh navigation"`;
  - `browser` (`browser.version()`) and `playwrightVersion`;
  - `app`: `git -C appDir rev-parse HEAD`, the SHA-256 of
    `git -C appDir diff HEAD`, and `git -C appDir status --porcelain` so new
    untracked files show. All `null` if there is no `appDir` Git repository;
  - `trigger`: `event`, `wallMs`;
  - `frameCount` and `traceSampleCount`;
  - `sampler: "rAF getBoundingClientRect + computed style"`;
  - `timingSource: "CDP screencast metadata.timestamp; frames arrive ~9–28ms
    after the page state they show"`;
  - `startedAt`.

**stdout:**

```json
{
  "ok": true,
  "takes": [
    { "takeId": "…", "dir": "artifacts/motion/<take-id>", "frameCount": 70,
      "traceSampleCount": 66, "triggerFound": true, "triggerEvent": "pointerdown",
      "framesMs": [-296.4, 801.2] }
  ],
  "takeIds": "<id1>,<id2>,<id3>",
  "next": "node /root/workspace/motion/cli.mjs inspect <id1>"
}
```

If the trigger listener never fires in a take, that take is kept with
`"triggerFound": false` and `msFromTrigger` values of `null`. The command then
returns `ok: false`, with an `error` naming the take and suggesting the
element may be covered or disabled, and exits 1.

## 6. `motion inspect`

`motion inspect <take-id> [--from <ms>] [--to <ms>] [--crop x,y,w,h]`. Times
are ms from the trigger. The window defaults to the whole take, so the first
call shows the full table and the next can narrow the window.

- **Table:** built from `trace.json` and returned as an array of row
  strings. It has one row per sample in the window where any watched value
  differs from the **last printed row**, plus the first and last rows.
  Comparing with the last printed row, not the previous sample, keeps slow
  drift visible. A value counts as changed if it moves ≥ 0.5 px (x, y, width,
  height) or changes at all (opacity, display, visibility, hidden, a listed
  attribute or style, or an element becoming `null` or reappearing).
  - **Values** are rounded to 0.01.
  - **Columns:** one per watched field that changes anywhere in the window,
    named `<element> <field>` (for example `first-answer height`).
  - **Length:** no row cap. Only changed rows are printed, and QM already cuts
    any tool output above 100,000 characters.

  Shape, with real values from spike take `ab/rec60-marker-1` (last rows of
  the close):

  ```
  ms      first-answer height   first-answer hidden   second-question y
  +230.1  2.25                  false                 363.75
  +246.8  0.59                  false                 362.09
  +263.5  76.78                 false                 438.28
  +280.1  0.00                  true                  361.50
  ```
- **Frames:** selects *every* screencast frame with
  `from ≤ msFromTrigger ≤ to + 30`, and echoes `framesWindow` in stdout. The
  extra 30 ms is there because a frame arrives about 9–28 ms after the page
  state it shows, so a window chosen from the table still includes the frame
  showing its last row.
  - **Decision:** it never samples and has no frame cap. Frames that do not
    fit one image continue on the next sheet (see Layout).
  - **No frames:** the table is returned with no sheets.
  - **Failures:** `from ≥ to`, or no trace samples when `watch` is non-empty.
- **Crop:** given in CSS pixels and scaled by `frame width / viewport width`.
  It is clamped to the frame, with a warning naming the frame size.
- **Layout (Decision):** the only limit is the real one: every sheet image
  fits 2000×2000 px and 4.5 MiB, which is what the model can see clearly.
  - **Tiles:** 4 columns of 400 px tiles, with height from the crop's aspect
    ratio and 4 px white gaps. A tile shrinks only if a single row would not
    fit, for example a very tall crop.
  - **Pages:** each sheet holds as many rows as fit in 2000 px. Remaining
    frames continue, in time order, on the next sheet. Nothing is dropped,
    skipped or refused.
  - **Byte fallback:** after writing a sheet, check its size. If it is over
    4.5 MiB (unlikely for UI frames), split that page into two and re-render.
    This always ends, because one tile of at most 400×2000 px is under 3.2 MB
    even uncompressed. `motion_view` would shrink it anyway, but sheets
    should arrive sharp.
  - **Labels:** each tile is labelled `+264.3 ms #12` in its top-left corner,
    where `#12` is the frame's file number in the take
    (`frames/000012.jpg`).
- **FFmpeg recipe** (verified in the computer on September 27):
  1. For each frame:
     `ffmpeg -i <frame>.jpg -vf "crop=w:h:x:y,scale=<W>:-2,drawtext=fontfile=/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf:text='<label>':fontsize=22:fontcolor=white:box=1:boxcolor=black@0.7:x=6:y=6" tile_NNN.png`.
  2. Then `ffmpeg -framerate 1 -i tile_%03d.png -vf "tile=4xR:padding=4:color=white" -frames:v 1 sheet.png`.

  Labels contain no `:` or `'`.
- **Output:** writes `sheets/inspect_<from>_<to>_<crop>_p<N>.png` inside the
  take directory, where `<crop>` is `x-y-w-h` or `full` and `N` counts from 1.
  Every sheet is within `motion_view`'s limits.
- **stdout:**

  ```json
  {
    "ok": true,
    "table": ["ms  first-answer height  …", "+230.1  2.25  …"],
    "framesWindow": [-50, 350],
    "frames": 30,
    "sheets": [
      { "path": "artifacts/motion/<take-id>/sheets/inspect_-50_320_full_p1.png",
        "fromMs": -48.2, "toMs": 247.9, "frames": 24 },
      { "path": "artifacts/motion/<take-id>/sheets/inspect_-50_320_full_p2.png",
        "fromMs": 263.5, "toMs": 346.8, "frames": 6 }
    ],
    "next": "call motion_view with the sheet covering the moment you care about"
  }
  ```

  `sheets` is empty when the window has no frames.

## 7. `motion compare`

`motion compare --before <take-id,…> --after <take-id,…> [--from <ms>]
[--to <ms>] [--crop x,y,w,h]`. The window, frames and crop work as in
section 6.

- **Refuses** takes whose URL, viewport, scale factor, reduced-motion
  setting, `ready`, `setup`, trigger or browser version differ. The error names the field and
  both values, and says "recapture with the same scenario".
- **Warns but continues** when:
  - the scenario name or watch list differs;
  - either side has fewer than 3 takes ("a one-frame defect can be missed");
  - before and after have the same app revision.
- **Layout (Decision):** one row per take, before rows first. Each row shows
  *every* frame of that take in the window, left to right, and its first tile
  carries the row label (`before 1`, `after 2`) drawn bottom-left, so no extra
  tile is needed and it doesn't overlap the time label. Columns are not forced to line up, because takes deliver
  frames at different times and forcing a grid would drop or repeat frames.
- **Size (Decision):** as in section 6, the only limit is 2000×2000 px and
  4.5 MiB per image.
  - **Tiles:** 240 px wide, with 4 px gaps, so a row holds 8 frames.
  - **Time slices:** when a take has more frames in the window, the window is
    cut into consecutive time slices. Each slice becomes its own sheet showing
    *all* takes for that stretch of time, so before and after stay side by
    side on every sheet.
  - **Many takes:** if the takes don't fit one sheet's height, they continue
    on the next. Nothing is dropped, skipped or refused.
- **Tables:** one section 6 table per take, labelled like the rows, so values
  can be compared take by take.
- **Output:** writes `artifacts/motion/compare-<UTC>-<4 hex>/sheet_p<N>.png`
  and a `compare.json` with the inputs, warnings, sheets and tables.
- **stdout:**

  ```json
  {
    "ok": true,
    "sheets": [
      { "path": "artifacts/motion/compare-…/sheet_p1.png", "fromMs": 200.1, "toMs": 316.8 }
    ],
    "warnings": [],
    "rows": [{ "label": "before 1", "takeId": "…", "frames": 9, "table": ["…"] }],
    "next": "call motion_view with each sheet path"
  }
  ```
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
   /root/workspace/<your-scenario>.json --label before`, and so on). Point to
   `cli.mjs help`.
3. Write a scenario file for the interaction being investigated (`cli.mjs
   help scenario`); `watch` names where to look. Do not mention or ship the
   Field Notes fixture.
4. Choose the window from the table, then view the sheets: pass a printed
   `sheets[].path` to `motion_view` verbatim. Long windows produce several
   sheets automatically; view the ones covering the moment that matters.
5. The rebound-style lesson: a defect can last a single frame, so view every
   frame in the window and take several takes.
6. Table times are exact page frame times. Sheet frame times are capture
   times, about 9–28ms after the paint they show.
7. After editing, capture new takes (3 by default) and use `motion compare`;
   report every take, including ones where the defect did not appear.
8. Images last one turn; call `motion_view` again in later turns.
9. Write the case (section 9) last; a GBrain failure is reported and never
   stops the investigation.

Its frontmatter `description` should use the words users use: "blink, jump,
flicker, flash, glitch, layout shift, animation, transition".

It must not mention Field Notes' cause or any fix. In the same milestone,
change `deployment/sandbox/skills/environment-operation/SKILL.md` to stop
calling agent-browser "the recorder"; the recorder is `motion capture`.

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

Only these checks are required.

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

**Milestone 5, the investigation turn.**

1. Deploy the skill.
2. Run `npm run demo -- reset`.
3. Hand the server to the agent in its **own** thread
   (`--thread handoff-<timestamp>`, [demo.md](demo.md#hand-the-server-to-qm)).
4. Send the user's request in a **new** thread, exactly, with no hints:
   `node scripts/qm-turn.mjs --thread investigate-<timestamp> --timeout 1200
   "<request>"`. You can also type it in the web UI. The request:

> When I close the first FAQ, the page seems to blink or jump at the end.
> Reproduce it, inspect the motion, and fix it while keeping the close
> animation and accessible interaction.

Tool success, checked by us from the reply and the take files: the agent's
description matches the trace, namely the first answer collapsing, then
reappearing for one sample around +250–285 ms, then hiding. It also cites a
frame or sample it actually viewed. It also writes the GBrain case (check
with `npm run computer -- gbrain get cases/motion-…`). The fix is a demo goal,
not a pass condition.

**Milestone 6:** the rehearsal runs are the tests. Do not add others.

Unit tests are optional; skip them if time is short. If written, they cover
only pure functions, live in `src/motion/*.test.mjs`, and run on the host
with `node --test src/motion`.
