# QM Motion

Give QM's coding agent intermediate visual evidence so it can investigate a web
interaction, fix the application, and verify the result over time. GBrain keeps
concise evidence-backed cases. The kickoff environment works; the motion
extension is the next implementation task.

## Run locally

Verified on Linux x86_64 with Docker + Compose, Node 25 (24+ required), npm,
Python 3, Git, curl, OpenSSL, and host Chromium at `/usr/bin/chromium`.
An OpenAI API key with GPT-6 Sol access is required. Existing local credentials
are configured in ignored files; subscription logins are not API credentials.

```bash
# On this already bootstrapped machine:
npm start
npm run login
```

QM opens at **https://localhost:8443**. Login uses QM's supported administrator
flow and a dedicated browser profile with trust for this project's certificate.
Do not copy the temporary sign-in link into documentation or chat.

On a fresh checkout, run `npm run bootstrap`, populate `OPENAI_API_KEY` in the
generated, ignored `deployment/.env`, then run the commands above. Bootstrap
downloads/builds pinned dependencies and generates local secrets. See
[setup](docs/setup.md) before moving an existing deployment to another machine.

```bash
npm run status       # QM, support services, and actual agent computer
npm run smoke        # real model, execution, capture, vision, durable memory
npm run smoke:ui     # normal web input, agent execution, and visible reply
npm run demo         # start the pinned target inside the QM computer
npm run demo -- check
npm stop             # retains databases and computer workspaces
```

Smoke creates the computer if needed, uses billable model calls, and briefly
restarts this project's GBrain/PostgreSQL services. The demo URL is
`http://localhost:4173` **inside the computer**. Its original Field Notes app
reproduces a historical Radix accordion defect; no repair is prewritten.

## Current foundation

- QM CLI 0.1.12, pi harness, OpenAI **GPT-6 Sol** (low effort setup baseline),
  durable local Docker computer.
- Stock Chromium, agent-browser 0.38.1, Playwright 1.63.0, FFmpeg; real PNG,
  short recording, and contact sheet verified inside that computer.
- GBrain 0.59.0.0 HTTP service with separate PostgreSQL and a source/prefix
  scoped OAuth thin client; real agent write and fresh-turn retrieval survive
  a normal service/database restart. Keyword retrieval needs no embedding key.
- Shared AGENTS.md / symlinked CLAUDE.md, selected Matt Pocock developer skills,
  and two separately deployed runtime skills.

Read [PROGRESS.md](PROGRESS.md) for exact evidence and limitations,
[docs/plan.md](docs/plan.md) for the 225-minute implementation sequence, and
[docs/demo.md](docs/demo.md) for reproduction and reset. Architecture,
provenance, licenses, and optional later releases are in [docs/](docs/).

First implement a bounded capture-to-vision path in a real QM turn. Incoming
attachments pass vision checks; returning a screenshot filename from a tool
still does not deliver its pixels to the model. Capture/inspect/compare product
operations, automated repair, and the complete demo remain unimplemented.
