# QM Motion

Give QM's coding agent intermediate visual evidence so it can investigate a web
interaction, fix the application, and verify the result over time. GBrain keeps
concise evidence-backed cases. The kickoff environment works; the motion
extension is the next implementation task.

## Run on Linux; access over Tailscale

Verified on Linux x86_64 with Docker + Compose, Node 25 (24+ required), npm,
Python 3, Git, curl, OpenSSL, and host Chromium at `/usr/bin/chromium`.
An OpenAI API key with GPT-6 Sol access is required. Existing local credentials
are configured in ignored files; subscription logins are not API credentials.

```bash
# On this already bootstrapped machine:
npm start
# Generate the sign-in link here; open it in your Mac browser:
(cd deployment && ./node_modules/.bin/qm admin-login)
```

On this deployment, open **https://charlies-pc.tail1d1ed7.ts.net** from a device
on the same Tailscale network. Linux runs the services; a Mac can use the web UI
without a local install or SSH tunnel. See [sign-in from your Mac](docs/setup.md#sign-in-from-your-mac)
for QM's existing administrator login. `npm run login` still opens Chromium
on the Linux box. Do not copy temporary sign-in links into documentation or chat.

On a fresh Linux machine, first set `publicUrl` in `deployment/qm.config.jsonc`
to that machine's address (`https://localhost:8443` for desktop-local access).
Run `npm run bootstrap`, populate `OPENAI_API_KEY` in the generated, ignored
`deployment/.env`, then run the commands above. Bootstrap
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

How it fits together (your Mac → Tailscale → QM on this Linux box → the
agent's computer) is in [the system in one picture](docs/architecture.md#the-system-in-one-picture).
Read [PROGRESS.md](PROGRESS.md) for exact evidence and limitations,
[docs/plan.md](docs/plan.md) for the 225-minute implementation sequence, and
[docs/demo.md](docs/demo.md) for reproduction and reset. Architecture,
provenance, licenses, and optional later releases are in [docs/](docs/).

First implement a bounded capture-to-vision path in a real QM turn. Incoming
attachments pass vision checks; returning a screenshot filename from a tool
still does not deliver its pixels to the model. Capture/inspect/compare product
operations, automated repair, and the complete demo remain unimplemented.
