---
name: environment-operation
description: Operate this QM Motion developer deployment, inspect its Docker computer, and troubleshoot QM or GBrain. Use for local setup and environment checks.
---

Run from the primary checkout root (worktrees lack the ignored state). Read `PROGRESS.md` and `docs/setup.md` first.
`npm run bootstrap` builds dependencies; `npm start`, `npm stop`, and
`npm run status` control only this deployment. Stop must retain volumes.
`npm run login` opens the supported one-use administrator login without printing
its credential. Use `npm run computer -- <command...>` for the single demo
computer. If absent, ask QM to execute a command; do not create an unrelated
container and claim agent execution passed.

After a new computer is provisioned, `python3 scripts/connect-gbrain.py` installs
its scoped OAuth thin client. `npm run computer -- gbrain whoami` verifies it.
Never copy GBrain database credentials or host subscription tokens into it.
`npm run smoke` writes real evidence under ignored `artifacts/smoke/`.
Read the exact failure and relevant service logs before changing configuration.
The project TLS certificate is private local trust; do not disable TLS globally.
Record passed, failed, blocked, and proposed behavior distinctly in PROGRESS.md.

This is a developer skill. QM has a separate runtime variant in
`deployment/sandbox/skills/environment-operation/`.
