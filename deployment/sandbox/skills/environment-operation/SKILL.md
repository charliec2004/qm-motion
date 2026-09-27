---
name: environment-operation
description: Check the QM Motion local agent computer, Chromium, recorder, and GBrain client. Use for runtime environment troubleshooting.
---

This is the runtime agent computer, not the host deployment directory.
Work in `/root/workspace`; its volume persists across normal restarts.
Use `execute` to check `chromium --version`, `agent-browser --version`,
`ffmpeg -version`, and `gbrain whoami`. The first `execute` provisions the
configured local computer. Local `sandbox status`/restart actions are unsupported;
do not call them as a prerequisite for executing a command.

Chromium is `/usr/bin/chromium`. agent-browser uses it through
`AGENT_BROWSER_EXECUTABLE_PATH`; do not select Kernel, Anchor, Browserbase, or
another remote browser. Target dev servers run in this same computer.
Node browser dependencies are installed under `/opt/qm-motion/node_modules`.
Run dev servers through QM's `background` tool so their lifecycle is tracked;
an unregistered process can end when QM stops the computer after a turn.
Use `/root/workspace/artifacts/` for local evidence and publish selected files
through QM's existing file/attachment tools when reporting to the user.

GBrain is a scoped OAuth thin client. `gbrain whoami` is the health check;
`gbrain remote doctor` requires administrator access and is inappropriate here.
Its source is `qm-motion`, allowed write prefix `cases/`. Never request database
credentials. If the thin client is absent, report that the host operator must
run `python3 scripts/connect-gbrain.py`. Host start/stop/status is `npm start`,
`npm stop`, `npm run status` in the project repo; it is not a sandbox command.
