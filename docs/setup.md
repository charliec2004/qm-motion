# Linux setup and Tailscale access

Run commands from the repository root. This is a Linux x86_64 prototype, tested
with Docker 29.7.2, Compose 5.5.0, Node 25.1.0, npm 11.6.2, Python 3, Git, curl,
OpenSSL, and host Chromium `/usr/bin/chromium` 148.0.7778.96. Docker must work
without an interactive elevation prompt. Bootstrap downloads several large
images and the GBrain binary; package and image pins are in
[references.md](references.md). Host Chromium handles administrator login;
the agent's separate Chromium 154.0.8037.57 handles local applications.

## Existing machine

```bash
npm start
npm run login
npm run status
```

QM is **https://charlies-pc.tail1d1ed7.ts.net** on this deployment, accessible
from devices on the same Tailscale network. `login` obtains a short-lived link through
`qm admin-login`, opens it without printing it, and uses the normal confirmation
page. The dedicated browser profile lives in ignored `.state/login-browser/`.
Only this local certificate's public-key fingerprint is exempted from browser
certificate errors. No global browser/system trust setting is changed.
If an agent shell lacks display variables, the launcher reads the existing
graphical user session's display settings without printing its environment.

Administrator: `charlieconner04@gmail.com`. The one demo scope is
`personal:charlieconner04@gmail.com`. It owns the actual QM-provisioned local
computer, not a manually created look-alike container. Keep this setup to that
scope. Agent operations exercised here required no additional approval prompts;
QM's authentication and policy checks remain enabled.

## Sign-in from your Mac

Keep Tailscale connected on both devices. The Linux box runs QM and the agent
computer; no Mac installation or SSH tunnel is needed. Sign in using the
administrator link below first. Opening the base address while signed out can
show **"Email delivery isn't configured"** because the email-login route has no
mail provider. No email setup is needed for administrator sign-in.

For the existing administrator sign-in, run this in the **T3 Code terminal on
Linux**, starting at the repository root:

```bash
(cd deployment && ./node_modules/.bin/qm admin-login)
```

Open the generated link in your Mac browser within five minutes and confirm
your email. The link is private and single-use; never paste it into chat or
commit it. This uses the supported QM login command, with the same credentials
and confirmation flow. `npm run login` opens the browser on Linux, so it is only
useful when you can see that desktop. Existing cookies for `localhost` do not
sign you into the new hostname. After confirmation, bookmark
**https://charlies-pc.tail1d1ed7.ts.net** for subsequent visits in that browser.

Tailscale Serve terminates HTTPS and proxies to the existing portal at
`http://127.0.0.1:8081`. Serve is private to the tailnet; Funnel is not enabled.
The one-time account Serve/HTTPS setup and this command configure the route:

```bash
sudo tailscale serve --bg --https=443 http://127.0.0.1:8081
tailscale serve status
```

The background route survives closing terminals and restarting Tailscale.
`npm stop` still stops QM; the retained Serve route then has no running backend.
To remove only this route, run `sudo tailscale serve --https=443 off`.
See [Tailscale Serve](https://tailscale.com/docs/features/tailscale-serve).
The deployment's `publicUrl` controls the login origin; startup and smoke
helpers read that address. GBrain's Docker-local address is unchanged.

## Fresh checkout

For a **different Linux machine**, first set `publicUrl` in
`deployment/qm.config.jsonc` to its own address. Use `https://localhost:8443` for
access on that machine's desktop, or its Tailscale HTTPS hostname with Serve
configured as above. Do not leave it pointing to this deployment's hostname.
macOS hosts are not supported by these scripts; a Mac can be the browser client.

```bash
npm run bootstrap
# Edit deployment/.env locally: set OPENAI_API_KEY without pasting it into chat.
npm start
npm run login
npm run smoke
npm run smoke:ui
npm run demo
```

Bootstrap runs both pinned npm installs, creates secrets only if their files
are absent, builds the computer and GBrain images, initializes the dedicated
database without embeddings, and provisions source `qm-motion` and client
`qm-motion-demo`. It preserves existing data. Its final `qm check` will report a
missing model key on a fresh machine; add the key and continue with `npm start`.
The selected runtime is **pi / openai / gpt-6-sol**. Startup verifies/registers
that actual model through QM's supported admin model registry; its first
verification and smoke turns incur ordinary API usage. The demo scope starts
with low effort through QM's supported runtime setting; later saved choices
are preserved. Smoke explicitly uses low effort for its simple checks.

Fresh `npm start` does not itself create a computer. A real QM `execute` call
does; `npm run smoke` performs one and then installs the scoped GBrain client.
If using the UI first, ask QM to create `/root/workspace` and run `pwd`, then run
`python3 scripts/connect-gbrain.py` on the host. After replacing the computer
container/image, rerun that connection command to restore its extra network.

## Credentials, ports, and storage

Tracked examples contain names/explanations only. Keep private backups of
these generated files with their associated database volumes:

| Location | Purpose |
| --- | --- |
| `deployment/.env` | `OPENAI_API_KEY`; generated QM signing/session/capability secrets and private `AUTH_SIGNING_JWK`; `ADMIN_GRANTS`, `AUTH_ALLOWED_EMAILS`, internal `PUBLIC_API_URL`. See its `.env.example`. |
| `.env` | `GBRAIN_DB_PASSWORD` for the dedicated database only. |
| `.state/gbrain-client.txt` | Scoped client-credentials grant; read/write source `qm-motion`, writes fenced to `cases/`, read federation only `qm-motion`. |
| `.state/tls/` | Project self-signed certificate/private key, valid 365 days. Public CA is installed only in this sandbox image. |
| `.state/portal-session.json` | Private session state for smoke/admin API checks; regenerated through normal login when expired. |

Secret files are ignored and mode 600. Do not regenerate credentials over
existing data; the scripts refuse missing environment files when their durable
volumes already exist. `AUTH_EMAIL_TRANSPORT=resend` satisfies the current
configuration validator, but email login is disabled without transport
credentials. The verified path is administrator login. No Slack credentials,
remote browser account, embedding key, or Anthropic key is needed.

Tailscale Serve exposes QM on tailnet HTTPS port 443. Caddy retains loopback
ports 8443 (QM) and 3443 (GBrain), but use the configured Tailscale hostname for
QM sign-in. The current QM CLI
also publishes 8080 core, 8081 portal/auth, and 8082 web/admin on all host
interfaces; keep those ports free. Application auth/signatures still apply.
PostgreSQL is not published. The computer connects to
`https://gbrain.qm.internal:3443` through a project Docker network; that name is
Docker-local. Do not change it to `*.localhost`, which some clients force to
loopback. Only the GBrain service gets the DB URL; computers get OAuth access.

QM owns its persistent data and computer home volumes. Support Compose owns
`qm-motion-support_brain-db` and `qm-motion-support_brain-config`. Agent work
lives under `/root/workspace`; its thin-client config is `/root/.gbrain/`.
Host evidence/logs live under ignored `artifacts/`. Raw videos stay out of Git
and GBrain; memory holds small records with artifact references.

## Verify and operate

```bash
npm run smoke
npm run computer -- chromium --version
npm run computer -- gbrain whoami
npm run demo
npm run demo -- check
npm run demo -- status
npm run demo -- reset
npm stop
npm start
```

Smoke checks CLI/static conformance, actual agent execution with an independently
read UUID, a neutral local browser capture/contact sheet, a random visual code
and colored shapes supplied as an actual image attachment, agent memory write,
and fresh-turn retrieval after GBrain **and PostgreSQL** restart. Results and
full run JSON are ignored under `artifacts/smoke/`. Do not run it concurrently
with a demo using those services. It is not a completed motion-product demo.
`npm run smoke:ui` separately drives the real web composer, checks the visible
reply, and independently reads the file written by that turn. Both smoke
commands expect the demo scope's verified low-effort selection and no active
QM background demo job; they wait for the computer to park before host reads.

`npm stop` stops only this project's computers/services and retains containers
and volumes. This also retains the computer's extra GBrain network connection;
upstream `qm down` removes agent containers as well as services.
There is no destructive database reset command. Demo reset creates a new pinned
working copy and retains prior runs/edits; see [demo.md](demo.md).

QM normally stops the local computer after an agent turn. Operator access
auto-starts an existing stopped computer. A manually launched demo server can
therefore end at turn teardown; `npm run demo` resumes the same editable copy.
For work across turns, stop the operator server, then have QM start it with its
supported `background` tool. The exact handoff and stop procedure are in
[demo.md](demo.md#hand-the-server-to-qm); host process controls do not manage
QM background jobs. Avoid simultaneous operator work and completing turns.
Smoke waits for actual computer parking before its independent Docker reads.

## Known upstream gaps and troubleshooting

- `qm check` and `qm conformance --static` pass. CLI 0.1.12
  `qm check --live` explicitly does not implement target Docker and exits 2.
  The real smoke checks above establish our working path separately.
- The tracked one-line [core patch](../deployment/runtime/patches/local-core-address.patch)
  forwards `QM_CORE_CONTAINER` into the local sandbox configuration. Without
  it, real command execution cannot reach the computer. `npm start` deploys
  the patched image using `qm up --build-from runtime`; do not substitute a
  plain upstream `qm up` and assume the correction remains applied.
- The packaged model catalog predates GPT-6 Sol. `scripts/enable-model.mjs`
  uses the supported registry with `deployment/model-gpt-6-sol.json` and
  provider verification. A reference checkout alone changes neither runtime
  code nor model availability.
- Image attachments work. Deployed QM's `read` tool still returns text; the
  small `motion_view` image tool is the first MVP dependency, detailed in
  [architecture.md](architecture.md#image-delivery-verified-by-reading-the-code).
  No `motion` capture/inspect/compare command has been implemented yet.
- GBrain runs without embeddings; keyword search is verified. Its `whoami`
  can report `agent_ready: false` for optional delegated-agent grants while
  our intended read/write operations work. Do not expand grants just for that
  field. Memory must remain optional to capture/inspection in product code.
- Intermittent post-tool model dispatch stalls occurred with both medium and
  low effort, although the complete low-effort suite passed. The exact cause
  remains unproved; low is a latency choice, not a demonstrated fix.
  The tracked [request retry patch](../deployment/runtime/patches/model-request-retry.patch)
  sets each provider attempt to 60 seconds with one retry before response
  headers, using Pi's existing settings. It retries the model continuation,
  not completed tools. Outer session retries are unchanged. Preserve and
  inspect a timed-out run before retrying; the helper saves run state and
  requests an abort through QM. This is not a reliable 90-second full-loop
  latency guarantee. Successful turn timings are recorded in PROGRESS.md.
- Missing computer: run a real QM execution first. Missing GBrain DNS/client:
  run `python3 scripts/connect-gbrain.py`. Provider failure: check key access
  and billing locally, never print the key. Service failure: use `npm run
  status`, then the particular Docker container's logs; retain logs privately.

Developer skills are discovered from `.agents/skills/` and relative
`.claude/skills/` links, on the next client turn/reload. QM runtime skills live
separately in `deployment/sandbox/skills/`; the deployment layer imports them
into QM's skill catalog, read with `read({path:"skill://<name>/SKILL.md"})` in
this pinned runtime. These guidance-only skills do
not require a matching developer skill directory inside the computer.
The Matt Pocock architecture aids are
optional and have not been run as an empty-repo survey.
