# QM Motion progress

September 27, 2026. **Kickoff environment and handoff verified; ready to start
the hack.** No additional credentials or environment setup are needed on this
machine. The motion product is intentionally not implemented by this kickoff.

**Build-ready checkpoint, September 27, 12:10 PM PT.**

- **Docs:** brief, architecture, spec and plan were reviewed by three fresh
  readers and all findings were fixed; every doc link resolves.
- **Environment, checked at 11:57:**
  - `npm run status` shows every QM, GBrain and computer container up;
  - the demo server is stopped (start it with `npm run demo` for milestones
    2–4);
  - `https://charlies-pc.tail1d1ed7.ts.net` is served tailnet-only and
    answers 401 until you sign in.
- **Git:** `main` is the only branch.
- **Start:** [plan.md](docs/plan.md) milestone 1.

## Build log (hackathon, September 27)

- **M1 passed, 1:47 PM.** `motion_view` patch deployed with `npm start`
  (found in `/app/src`); `qm-turn.mjs` has `--thread` (required) and
  `--timeout`. Real turn (thread `mv-1790541947`, run `eea0d7e6…`) called
  `motion_view` once and replied with the withheld code exactly; its text
  result held only path, size and SHA-256. `artifacts/motion/m1-result.json`,
  `artifacts/smoke/run-eea0d7e6-f6b1-4a77-b878-3a834d3b011c.json`.
- **M2 passed, 1:50 PM.** `motion capture --takes 3` (src/motion, copied to
  `/root/workspace/motion`) wrote frames, `frames.json`, `trace.json` and a
  manifest per take; all 3 traces show the one-sample reopen (0.59/0.00 →
  76.78 → hidden at +259.8, +278.2, +277.9 ms). `artifacts/motion/m2-*.json|txt`.
- **M3 passed, 1:52 PM.** `motion inspect` printed the change table (reopen
  row `+259.8 … 76.78`) and one 18-frame sheet in 1.8 s; a tall crop split into
  3 sheets automatically. Sheet frame #17 (+268.2 ms) shows the reopened
  answer. `artifacts/motion/m3-inspect-*.json`, `artifacts/motion/m3/`.
- **M4 passed, 1:53 PM.** `motion compare` on the M2 takes vs 3 unchanged
  "after" takes: per-take tables (reopen in all 6), 3 time-sliced sheets with
  one labelled row per take, same-revision warning; a take at an 800 px viewport
  was refused naming the field. `artifacts/motion/m4-*.json`, `artifacts/motion/m4/`.
- **M5 passed, 1:59 PM.** Skill deployed (layer v5); demo reset with defect
  hints (README, check.mjs, package name, baseline commit message) kept out of
  the agent's copy. One real turn with the verbatim request (87 s): the agent
  wrote its own scenario, captured 3 takes, read the table, viewed sheets with
  `motion_view`, fixed `style.css` (`forwards` on the collapse), captured 3
  after-takes, compared, attached 2 sheets, and wrote a searchable GBrain case.
  Host re-check: before takes reopen at +276.4/+261.3/+277.6 ms, after takes
  none. The reply itself cites no ms; the case does. `artifacts/motion/m5-*`.
- **M6 passed, 2:13 PM.** Reset now archives earlier runs to
  `/root/qm-motion-demo-archive/`; each run's agent evidence was archived to
  `/root/motion-archive/` and host tars before the next reset.
  - Second investigation, typed in the web UI after a source reset (run
    `85907518…`): reopen in 3/3 before-takes, none after; it rejected its first
    `forwards` fix after a reopen test, committed an `onAnimationEnd` fix.
  - Fresh-thread recall (run `44f81440…`, 10 s): `gbrain search` then `get`
    returned that case's slug, token, diagnosis and result.
  - Labelled recording of a third, complete real investigation typed in the web
    UI (run `3de967d9…`, 4 min 16 s real time, 3 sheets inline):
    `artifacts/demo-recording/20260927T210759/investigation-labelled.mp4`.
    Reopen in 3/3 before-takes, 0/9 after; case written with a lowercase slug.
  - The first recording attempt was cut off when the session ended; launch
    `scripts/record-investigation.mjs` with `setsid nohup … &` so it survives.
  - Demo state now: fixed copy `4907577` served by QM background job
    `8c202320…` (thread in `artifacts/motion/m6-handoff3-thread.txt`). Before
    presenting live, stop it there and run `npm run demo -- reset`.
- **Trailhead mock demo passed, 3:00 PM.** New demo shape, typed in the web UI:
  the agent *builds* an FAQ on pinned `@radix-ui/react-accordion@0.1.5` +
  React `18.0.0-rc.0`, a code review passes it, then a motion check finds and
  fixes the rebound. Prompts are in [demo.md](docs/demo.md#agent-built-target-trailhead).
  - First build used `ReactDOM.render`: 0/3 host probe takes rebound. A copy
    switched to `createRoot` (from `react-dom`; rc.0 has no `react-dom/client`)
    rebounded 3/3, so the build prompt now asks for `createRoot`.
  - Rerun: agent wrote `createRoot` and keyframes without `forwards`; host
    probe rebounded 3/3 (0 → 132 px → hidden, ~+310 ms), probes then deleted.
    The review ("no motion recordings") passed the animation.
  - Motion turn (~4 min): reopen in 3/3 before-takes; its first `forwards` fix
    snapped 132 → 0 px at +60 ms and was rejected from the trace; a grid-wrapper
    fix closed cleanly in 3/3 after-takes. Host check: opening still animates
    0 → 105.75 px over ~350 ms. Case `cases/motion-20260927t215655-before-1-8c49`
    written. Compare warned the app had no Git revision.
  - Evidence: `artifacts/trailhead-mock/trailhead-mock.tgz` (app without
    `node_modules`, takes, compares).
  - Clean slate before the run: prior Field Notes material moved from
    `/root/workspace` to `/root/m5-archive/` (including `qm-motion-demo`, so
    `npm run demo` needs it moved back); GBrain pages backed up to
    `artifacts/gbrain-backup/` and soft-deleted (restorable until Sep 28 ~2:45 PM).
- **Trailhead storefront fixture, 3:20 PM.** `targets/trailhead` (existing
  storefront repo; the agent adds the FAQ) and `npm run trailhead -- install`.
  Installed at `/root/workspace/trailhead-storefront` (`1526537`); earlier copies
  and takes archived to `/root/demo-archive/`. Pages, tabs keyboard navigation
  and `createRoot` checked; a plain keyframe accordion in a copy outside the
  workspace rebounded 3/3 (probe deleted). Not yet run with the agent. GBrain
  still holds the rehearsal case; soft-delete it before a clean run. Prompts:
  [demo.md](docs/demo.md#agent-built-target-trailhead).
- **User videos from `motion compare`, 4:05 PM.** Compare now also encodes two
  plain videos for the user, the first before and first after take, at real
  speed (60 fps, every captured frame shown at least once: 20/20 and 19/19 in
  the scratch check) with a cursor at the click position capture now records.
  Each has an inline `.html` player (WebM + MP4 data URIs). An earlier
  side-by-side/slow-motion version was dropped as too much; the separate
  `video` command was removed. Real UI turn `aa02c4c9…` showed an attached
  `.html` player playing inline in QM chat (WebM, readyState 4). The skill
  says to attach `video.attach`, label Before and After, say where to look,
  and not attach sheets.
  - Final real UI turn after deploying layer v9 (run `06735b3b…`): the agent
    ran compare on scratch takes and attached exactly `before.html` and
    `after.html`; both played inline (960×720 WebM, readyState 4). Its reply
    labelled Before and After with the reopen times and reported the
    same-revision caveat. Its GBrain write hit a revision conflict because an
    earlier test turn had used the same slug; it reported that plainly.
  - Scratch takes and the scratch app were deleted. GBrain still holds that
    test case (`cases/motion-20260927t224445-probevb-1-e5b4`, it describes the
    rebound): back it up and soft-delete it before a clean demo run.

## Working foundation

- Private repository created and visibility verified:
  [charliec2004/qm-motion](https://github.com/charliec2004/qm-motion).
- QM CLI 0.1.12, web/admin address `https://charlies-pc.tail1d1ed7.ts.net`, **pi /
  OpenAI GPT-6 Sol**. The user-supplied API key is in ignored `deployment/.env`.
  The demo scope defaults to low effort through the supported runtime API.
- Actual local Docker computer with durable `/root` volume, Chromium
  154.0.8037.57, agent-browser 0.38.1, Playwright 1.63.0, FFmpeg 5.1.9.
- Separate GBrain 0.59.0.0 HTTPS server/PostgreSQL. The computer's OAuth client
  has read/write source `qm-motion`, writes under `cases/`, and no DB credential.
  Keyword search works without embeddings or an extra provider key.
- Concise AGENTS.md and Git symlink CLAUDE.md; selected Matt Pocock
  architecture skills and their dependencies in documented developer locations;
  two separate project runtime skills installed through the QM deployment layer.
- Pinned Field Notes/Radix target, non-destructive reset, implementation plan,
  roadmap, references/licenses, and repeatable operator commands are in place.

## Last real checks

Evidence stays in ignored `artifacts/`; none of the private transcripts, images,
recordings, database contents, or credential files belongs in Git.

Tailscale access added after kickoff: Serve privately proxies HTTPS
`charlies-pc.tail1d1ed7.ts.net:443` to portal port 8081, with no Funnel route.
Startup applied the new public origin and signed in through the existing
administrator flow. Strict browser certificate validation, authenticated API
HTTP 200, and the visible composer passed (`artifacts/smoke/tailscale-access.json`).
The real web UI sent a GPT-6 Sol turn, rendered its reply, and independently
verified the file it wrote in the QM computer (`artifacts/smoke/tailscale-ui.log`).
The login script and credentials are unchanged. On a Mac, generate the usual
`qm admin-login` link in the Linux terminal and open it in the Mac browser;
opening the base address while signed out reaches the unconfigured email route.
See [setup.md](docs/setup.md#sign-in-from-your-mac).

| Check | Result and local evidence |
| --- | --- |
| Bootstrap rerun | Passed, existing state retained; `artifacts/bootstrap-verify.log`. |
| Normal login and UI | Real administrator confirmation, normal web send, rendered GPT-6 Sol reply, and independent file read passed. Desktop login launcher also opened successfully. `artifacts/smoke/ui-final.log`, `qm-ui-execution.png`, and `ui-execution-result.json`. |
| Model and command | Fresh GPT-6 Sol reply; agent wrote/read a UUID, independently read from the actual computer. Final suite command 4.061s. |
| Browser/capture | Actual computer generated PNG, 3.100s WebM, two-frame contact sheet; `artifacts/smoke/browser/`. |
| Model vision and memory write | Random six-digit image code and all three colored shapes identified through an actual attachment; agent wrote/read a unique GBrain case. 20.158s. |
| Durable memory | GBrain service and PostgreSQL stopped/restarted; fresh QM turn retrieved a withheld token and searched for it, with independent client verification. 10.102s. |
| Combined smoke | `npm run smoke` passed all phases against the rebuilt core with both patches; `artifacts/smoke/final-runtime.log` and `*-result.json`. |
| Demo and editable restart | Chromium reproduced the real closing rebound in 3/3 runs. Stop/start retained edited source hash, current path, and Git baseline; reset made a pristine copy while retaining edits. `artifacts/demo-lifecycle-result.json`. |
| Agent-owned demo and runtime skills | Agent read both actual `skill://` resources, started/polled a registered background server, ran the Chromium probe, and retrieved memory. A fresh conversation verified the server still running. It then stopped normally; host start correctly refused its occupied port during the test. `artifacts/smoke/background-result.json`, `background-fresh-result.json`, `background-stop-result.json`. |
| Full service lifecycle | Stop/start retained databases, workspace, scoped client, and computer network. Startup/status passed; subsequent UI and agent browser/memory checks passed. `artifacts/retained-stop.log`, `retained-start.log`, and `final-status.log`. |
| Retry boundary | Isolated installed Pi transport tests: one transient 503 retries once and succeeds; repeated 503 exhausts that budget; a stream error after output is not retried. Mocked transport, separate from live checks; no claim of a timed 60-second outage test. `artifacts/smoke/provider-retry-isolated/result.json`. |
| Repository hygiene | Staged secret-value/path/size audit passed; CLAUDE.md mode 120000, all six Claude skill links resolve; Bash/Python/Node syntax and documentation links checked. |

Earlier setup failures are retained honestly: unpatched QM could not address its
computer; two explicit medium-effort UUID continuations dispatched after tool
success but produced no response within 240s. Low effort passed the same work,
but a later low-effort UI turn also stalled; a separate Auto command passed.
Low is a latency choice, not a demonstrated fix. The exact cause is unproved.
Timed-out runs were preserved and aborted through QM. A second small tracked
patch now configures Pi's existing provider request timeout/retry settings:
60 seconds per attempt and one retry before headers, without replaying tools.
Outer session retries are unchanged; smoke retains its 240-second run limit.
The final smoke also
waits for computer parking before host reads, avoiding teardown exit 137.

## Remaining boundaries and next task

No missing model, browser, GBrain, or GitHub credential remains. Upstream
`qm check --live` is unsupported for Docker (exit 2); `qm check`, static
conformance, and the real smoke above pass. Both tracked core patches and
supported GPT-6 Sol catalog registration are applied by startup.
Use [setup.md](docs/setup.md), including the documented ports and latency limits.

Incoming-image vision is verified. **Automatic capture-tool image delivery is
not implemented**: the deployed QM `read` tool returns text.

Pre-build investigation, September 27, 9:20–10:55 AM PT:

- **Code reading** (not a live turn). In the running core and pi 0.82.0, a tool
  returning a pi image block reaches GPT-6 Sol as `input_image` in
  `function_call_output`. Only a new tool plus a byte read on `ToolContext` is
  missing; MCP drops images.
- **API probe** (real call, outside QM). `gpt-6-sol` on the Responses API read
  a withheld six-digit code from a PNG returned as a tool result, in 2 of 2
  variants. A second probe ran pi's own library inside the QM core container
  and passed the same way. `artifacts/openai-tool-image-probe/`.
- **Deployment facts** (read from code and live config). The security posture
  is `auto`, but screening is off, so there is no notice on tool images. The
  web chat shows attached PNG/JPEG/WebP inline; video gets a download card.
  (Corrected 3:30 PM from the deployed bundle: images on the allowlist, GIF
  and animated WebP included, render as `<img>` capped at 320 px; `.html`
  renders inline in a sandboxed 360 px iframe; core types `.mp4`/`.webm` as
  `application/octet-stream`, and there is no `<video>` path.)
  `threadRef` names continue conversations, and the default is one shared
  thread. After a sandbox image rebuild: `npm stop && npm start`, one agent
  command, then `python3 scripts/connect-gbrain.py` for GBrain. Skills deploy with
  `npm start` (`PUT /v1/deployment-layer`, applied within 30 s). The spec's
  Field Notes locators were validated on the live page in the computer, and
  FFmpeg label/tile commands were tested there.
- **Capture spike** (measured in the QM computer). The one-frame rebound was
  caught in 7 of 7 raw CDP screencast runs, 13 of 14 agent-browser runs at
  60fps, and 2 of 3 at 30fps. Recording did not suppress it, and slow motion
  does not widen it. Raw screencast is now the chosen capture primitive.
  Evidence is in ignored `artifacts/motion-spike/`.

Details: [image delivery](docs/architecture.md#image-delivery-verified-by-reading-the-code),
[sandbox rebuilds](docs/architecture.md#sandbox-image-changes), and the exact
contracts in [spec.md](docs/spec.md).
All six plan milestones have passed. The build log above records three real
investigations with before/after repairs; a full loop takes 1.5–4 minutes, so
the demo uses the labelled recording.

Start with `npm start` and [administrator sign-in](docs/setup.md#sign-in-from-your-mac);
`npm run login` is for the Linux desktop. Use `npm run demo` for the target.
Read [demo.md](docs/demo.md#hand-the-server-to-qm) before handing the dev server
from operator control to QM's `background` tool. Stop retains containers/data;
only explicit demo reset creates a fresh target copy.
