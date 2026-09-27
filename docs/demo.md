# Demo target and rehearsal

The selected target is **Field Notes**, an original small FAQ app around a real
historical Radix interaction defect:
[Accordion close-animation flicker, issue #1074](https://github.com/radix-ui/primitives/issues/1074).
The unmodified affected library is `@radix-ui/react-accordion@0.1.5`, with
React/ReactDOM `18.0.0-rc.0` and a concurrent root. Radix release source is pinned
to `2107c0e488247972a06be4248e5c98875f8e8aaa`; the npm lockfile pins the installed
artifacts. [demo/baseline.sha256](../demo/baseline.sha256) fixes the starting
app source. Original fixture and upstream dependency provenance/licenses are in
[demo/README.md](../demo/README.md). The app contains no prewritten repair.

## Current verification

On September 27, 2026, host Chromium `148.0.7778.96` at `960×720` reproduced a
closing layout rebound in 12/12 independent fresh navigations. One run shrank
the first answer to `0.59px` at `240ms`, reopened it to `76.78px` at `258ms`, and
hid it at `274ms`, measured relative to the click. A repeat using the retained
readiness script reproduced the rebound in 3/3 runs. Ignored local evidence:
`artifacts/demo-target/host-samples.json` and
`artifacts/demo-target/readiness/geometry.json`.

The actual QM computer also passed the readiness check using local Chromium
`154.0.8037.57`: closing rebound in 3/3 fresh runs. Its evidence was copied to
`artifacts/demo-target/sandbox-readiness/geometry.json` and `settled.png` on the
host. A short host browser video is in the ignored
`artifacts/demo-target/recording/` directory.
Sandbox startup, status, repeated startup and reset were exercised. Reset
retained an operator-written sentinel in the old working copy and created a
clean local Git baseline in the new working copy. The temporary host dev server was stopped after
verification; the supported demo command runs the app in the QM computer.

The final agent acceptance check also loaded both runtime skills, started and
polled the server through QM's `background` tool, ran the actual Chromium probe
with rebounds in 3/3 runs, and read the durable GBrain case. A fresh conversation
polled that same process and fetched Field Notes successfully. Normal background
stop and the operator's occupied-port refusal passed. Evidence is under
`artifacts/smoke/background-*.json`; this verifies the handoff below.

These are real Chromium geometry observations, not a claim of completed model
vision, agent diagnosis/repair, or before/after comparison. Geometry sampling
can affect rendering; no smoothness claim follows from nominal FPS. The full
60–90 second agent workflow remains a product implementation/rehearsal task.

## Start, reproduce, and reset

1. Start the project and create its QM agent computer as described in setup.
2. Run `npm run demo`. On first use it installs locked dependencies into a
   retained copy under `/root/workspace/qm-motion-demo/runs/`; later starts reuse
   that copy and its edits. It serves `http://localhost:4173` **inside that
   computer**. `current` points to the editable copy. The host's localhost is a
   different network namespace.
3. Run `npm run demo -- check` for the target-readiness probe. The selected
   computer's current run retains `evidence/geometry.json` and `settled.png`.
4. Open the app in that computer's Chromium at `960×720`, normal motion,
   device scale 1. Fresh navigation opens the first question. Wait at least
   `350ms`, then click **What comes with a Field Notes membership?** once.
   Observe the end of its `250ms` close and the questions beneath it.
5. Between before/after takes, start fresh; keep viewport, motion settings,
   dependencies and click target fixed. The saved scenario records 300 ms
   before and 800 ms after the click ([spec §4](spec.md#4-scenario-file)).
   Preserve actual trigger and frame timestamps and browser and source
   versions.

`npm run demo -- status` reports the workspace and the operator-managed process.
`npm run demo` reuses a running operator server or restarts it in the same
`current` copy, preserving source edits and installed dependencies. Only first
use and `npm run demo -- reset` create a **new** pristine copy; reset retains
every previous run and its edits. `npm run demo -- stop` stops the known operator
server and retains data. Root `demo/` is the pinned baseline; application edits
belong in the computer's `current` working copy. The server watches source
changes. Each new copy has a local Git baseline so the agent can inspect its
diff. Baseline hashes are checked when creating a copy, not when resuming edits.

## Hand the server to QM

QM can stop its local computer when a turn finishes. For a workflow spanning
turns, the agent must own the server through the supported `background` tool.
The operator runner and QM's background registry are separate process owners.

1. Prepare the target and perform any desired reset using the host commands
   above. Then run `npm run demo -- stop` on the host to free port 4173 while
   retaining the current source and dependencies.
2. In a live QM turn, call its **`background` tool** with these arguments:

   ```json
   {"action":"start","purpose":"Run demo server","command":"cd /root/workspace/qm-motion-demo/current && exec node server.mjs","timeout_seconds":3600}
   ```

3. Keep the returned process ID. Call `background` with
   `{"action":"poll","process_id":"<returned ID>","wait_seconds":1}` and
   confirm startup output and running status. Use `execute` to check
   `curl --fail http://localhost:4173/` before opening Chromium. Later polls can
   set `since_cursor` to the returned cursor; `{"action":"list"}` lists jobs.
4. Before a host reset or returning to operator ownership, call `background`
   with `{"action":"stop","process_id":"<returned ID>"}`, then poll until
   it has exited. `npm run demo` now resumes the same edits; use
   `npm run demo -- reset` only when a fresh baseline is intended.

These are QM tool calls, not shell commands or a proposed new CLI. The exact
fields come from the pinned QM `src/harness/agent-tools.ts` background schema.
Pinned QM defaults to a 30-minute lifetime and one-hour maximum, so a
warm-up lasting longer needs a fresh background start. The host runner's
status/stop commands do not manage this QM job. Do not run host start/reset
while it is active; the runner refuses an occupied port instead of starting a
second server. Avoid concurrent host operations while a QM turn is completing.

## Warm-up and 90-second script

**Primary plan:** present a labelled recording of a real investigation,
because a full loop takes minutes. Run it live only if measured timing fits.

Before presenting, warm the model connection, browser, target build and memory
client; confirm the first FAQ opens; reset the target; verify evidence storage;
hand the server to QM as above; then check that actual image blocks reach the
agent. Do not treat the readiness probe or a PNG filename as that last check.
Full workflow timing is unmeasured.

- **0–10s:** Ask QM: “When I close the first FAQ, the page seems to blink or jump
  at the end. Reproduce it, inspect the motion, and fix it while keeping the
  close animation and accessible interaction.”
- **10–25s:** Show the short before capture and trigger-aligned evidence.
- **25–40s:** Let the model identify the visible failure and inspect relevant code.
- **40–60s:** Show its chosen edit and fresh takes of the identical interaction.
- **60–80s:** Show before/after frames plus the model's qualified judgment; retain
  the compact case record and evidence references in GBrain.
- **80–90s:** Retrieve that record and state what was verified.

This schedule is the planned product demo, not an implemented scripted repair.
If the final live workflow fails, use a previously verified saved investigation recording and label
it as recorded. If only setup evidence exists, show the real target and explain
the implementation boundary; do not portray setup checks as an agent repair.

## Notes for later

Decided September 27: a dependency upgrade is an acceptable agent fix if the
agent first shows the rebound in captured frames, explains it, and its
after-takes show it gone. The agent may upgrade React too; keep the pinned
starting state, because the defect was verified only with it. Checked from the
computer the same day: the npm registry is reachable; the latest
`@radix-ui/react-accordion` is 1.2.20, and its peer range excludes the pinned
`18.0.0-rc.0`. The demo's `legacy-peer-deps=true` makes install warn rather
than fail. Unverified: whether 1.2.20 removes the rebound. Never give the
agent a diagnosis or the fixing version.

Latency affects only the demo and test tooling, not the motion tools. One cold
command turn took 78.467s, and a full capture → fix → compare loop in one
turn is unmeasured and likely takes minutes. That is longer than the 60–90
second slot, so plan to show a labelled recording of a real investigation. The
`qm-turn.mjs` 240-second abort will be lifted by the `--timeout` flag that
milestone 1 adds
([spec §2](spec.md#2-running-real-turns)).
