# QM Motion

Extend QM's coding agent with temporal browser evidence: reproduce, capture,
inspect, edit, repeat, compare, and report. GBrain retains concise case records.
This kickoff prepares the environment; the motion extension is still to build.

## Read first

- `PROGRESS.md`: actual checks, blockers, and the next concrete task.
- `docs/brief.md`: scope and acceptance criteria.
- `docs/architecture.md`: component ownership and evidence flow.
- `docs/setup.md`: environment and credentials.
- `docs/plan.md`: ordered implementation work and the cut list.
- `docs/demo.md`: target revision, reproduction, and presentation.
- `docs/references.md`: pins, licenses, and reused code.

## Time and scope

YC Own Your Intelligence: September 27, 2026, 1:15–5:00 PM Pacific.
The build window is 225 minutes; the demo is 60–90 seconds.
Support one harness, stock local Chromium, one real target, and short captures.
Prefer one working end-to-end slice over abstractions or broad refactoring.
Never hard-code the diagnosis or manufacture a broken CSS line for the demo.
Do not build a new general agent, custom browser, dashboard, or memory system.
Optional follow-on work belongs in `docs/roadmap.md`.

## Commands

Commands run from this repository root; verification status is in PROGRESS.md.
- `npm ci`: install pinned project dependencies.
- `npm run bootstrap`: prepare dependencies, local secrets, and container images.
- `npm start`: start QM, GBrain, PostgreSQL, and the local TLS front door.
- `npm run status`: report actual service state.
- `npm run login`: open a short-lived administrator login locally.
- `npm run computer -- <command...>`: execute in the selected QM computer.
- `npm run smoke`: run the environment checks and retain ignored evidence.
- `npm run smoke:ui`: verify real web input, tool execution, and rendered reply.
- `npm run demo`: prepare/start the pinned upstream demo target.
- `npm stop`: stop this project's services, retaining volumes and workspaces.
- `cd deployment && npm exec qm -- check`: validate deployment configuration.
- `cd deployment && npm exec qm -- check --live`: unsupported for Docker in 0.1.12.
An exit code or filename alone is not proof of a successful agent workflow.

## Repository map

- `deployment/`: CLI-managed QM config, support Compose services, runtime skills.
- `scripts/`: repeatable operator setup, access, and smoke checks.
- `src/`: motion integration implementation (not implemented during kickoff).
- `docs/`: short product, setup, implementation, and demo documentation.
- `.agents/skills/`: developer skills discovered by Codex/Astra.
- `.claude/skills/`: relative links for Claude Code/Fable discovery.
- `CLAUDE.md`: relative symlink to this authoritative file.
- `.upstream/`: ignored pinned checkouts; never mistake these for our code.
- `.state/`: ignored local credentials, TLS keys, tooling, and session state.
- `artifacts/`: ignored smoke evidence, build logs, and raw recordings.

## Ownership and secrets

The npm QM package owns the runtime and deployment CLI. The pinned QM checkout
is reference material. Track any necessary source patch explicitly, with its
base commit, and rebuild the actual service; a layer build is not deployment.
The local sandbox image must include QM's execution daemon and browser tools.
GBrain is a separate service. Agent computers get only a scoped thin client;
never give them its database credentials or administrative OAuth grants.
Use local Chromium for localhost applications; no paid remote browser fallback.
Never commit secrets, login links, browser profiles, cookies, database files,
runtime volumes, node_modules, raw videos, or private session transcripts.
Use ignored mode-600 files and supported provider/admin forms for credentials.
Never copy developer subscription tokens into QM as invented API credentials.
Preserve unrelated work and services. Stop retains data; destructive reset
requires an explicit user request and a precisely identified target.

## Evidence and implementation

Distinguish implemented, proposed, failed, and blocked behavior everywhere.
Verify real model output, real command execution, and actual image delivery.
A PNG path in a text tool result does not put an image in model vision context.
Retain browser/version, viewport, app revision, initial state, interaction steps,
actual timestamps, capture overhead caveats, and durable evidence references.
Align before/after runs to the interaction trigger, and reset state between runs.
Pixel differences measure change; the agent judges whether intent is satisfied.
Do not claim smoothness from nominal FPS or filter click-induced movement away.
Memory failure must leave capture and inspection usable and visibly report failure.
Test meaningful boundaries and the happy path; avoid exhaustive tests and
mock-only integration claims. Repeat checks after relevant changes or failures.
Keep changes small and inspect the staged diff before committing or pushing.
Update PROGRESS.md at useful checkpoints so another agent can resume directly.
Do ordinary authorized work without repeatedly asking for confirmation.
Delegate independent bounded tasks only when supported and useful; assign
non-overlapping edits and verify the combined result before calling it done.
Architecture-review skills are optional aids, never mandatory kickoff ceremony.
