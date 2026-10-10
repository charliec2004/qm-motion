# Using the motion workflow

After changes to animated or transient UI, the QM agent should inspect the
affected interactions automatically. Explicit requests to skip or defer
recordings take precedence. For new UI without a baseline, it checks the
current state rather than inventing a before/after improvement.

## Demonstrate the problem

Start the app's dev server on port 5173 in the agent computer, then open the
[live preview](setup.md#live-view-of-the-agents-dev-server). The preview adds a
**Demonstrate to QM Motion** control panel. This is a recording surface for the
local app; it does not share your browser cookies or session with the agent.

1. Use a clean, logged-out page with no saved app state. Start recording;
   this reloads the initial page.
2. Perform the clicks/control keys that demonstrate the problem, then Stop.
3. Describe the problem, select the action to align to, and Export for QM.
4. Attach `motion-demonstration.json` to your QM conversation. The agent can
   capture its scenario directly and add watched elements for measurements.

The initial version supports at most 32 actions over eight seconds. It does
not record field values, cookies or app storage. Form edits, scroll/drag/touch,
external navigation, new tabs, browser back/forward, and resizing are unsupported;
reported unsupported actions prevent export. Authentication and server-side
state cannot be transferred: the agent may need to establish a reproducible
initial state before replaying. Captures run in a fresh local Chromium context.

## Record a sequence

An existing single `trigger` remains supported. To capture interrupted or
repeated interactions, use `actions` instead:

```json
{
  "name": "menu-close-reopen",
  "url": "http://localhost:5173/",
  "actions": [
    { "id": "open", "atMs": 0, "action": "click", "selector": "#menu-toggle" },
    { "id": "close", "atMs": 150, "action": "click", "selector": "#menu-toggle" },
    { "id": "reopen", "atMs": 250, "action": "click", "selector": "#menu-toggle" }
  ],
  "alignAction": "close",
  "watch": [{ "name": "menu", "selector": "#menu" }],
  "recordBeforeMs": 300,
  "recordAfterMs": 800
}
```

`atMs` is a requested offset from the first action dispatch. The manifest
retains actual dispatch and observed event times separately; it never treats
requested timing as measured timing. The full recording is bounded to ten
seconds including the sequence. Actions support click, hover, press and
navigation. Failures retain partial evidence with the failed action identified.

Use `motion inspect <take-id> --align-action reopen` or
`motion compare --before <ids> --after <ids> --align-action reopen` to change
the alignment anchor without recapturing. Both sides must use the same sequence
and anchor. Existing takes without sequence metadata keep their single trigger.
The executable remains `node /opt/qm-motion/cli/cli.mjs`.

## Compare and report

The comparison attachment has one shared timeline, take selectors on both
sides, slow-motion controls, and separate frame-step buttons. Stepping uses
actual captured frames; the other side holds its latest frame at that time.
Timing labels make that distinction visible. Captured timestamps are not exact
paint times and playback frame rate is not a smoothness score.

To mark the interval discussed in the reply, write a JSON file such as:

```json
[
  {
    "fromMs": 120,
    "toMs": 170,
    "label": "Menu shift",
    "description": "Watch the menu's left edge during opening."
  }
]
```

Pass it with `compare --markers <file.json>`. Markers must lie inside the
observed playback range and use the selected action as zero. The final
`video.attach` list includes the HTML player and separate MP4 downloads;
the agent attaches all of them. The model inspects frame sheets with
`motion_view` and describes those observations, not unseen generated videos.

During an investigation the agent should share an initial finding, distinguish
observations from possible causes, and report rejected fixes as work continues.
See [PROGRESS.md](../PROGRESS.md) for runtime delivery and deployment status.

## Developer checks

After `npm ci`, `npm test` runs the focused motion tests, including isolated
Chromium checks when Playwright is installed. Chromium defaults to
`/usr/bin/chromium`; the player test accepts `QM_PLAYBACK_CHROMIUM`.
In a dependency-free worktree, set `MOTION_TEST_PLAYWRIGHT_PACKAGE` to the
primary checkout's `package.json` and `QM_PLAYBACK_PLAYWRIGHT` to its
`node_modules/playwright` directory. Browser checks are explicitly skipped
when their dependency is unavailable; a skipped check is not a pass.

The pinned-runtime attachment checks have a separate extraction procedure in
[the runtime overlay README](../deployment/runtime/interim-attachments/README.md).
Actual QM model invocation and live attachment delivery also require a valid
configured API key; check PROGRESS.md for those results.
