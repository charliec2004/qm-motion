# QM Motion progress

September 27, 2026. **Kickoff environment and handoff verified; ready to start
the hack.** No additional credentials or environment setup are needed on this
machine. The motion product is intentionally not implemented by this kickoff.

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
not implemented**: the deployed QM `read` tool returns text. The first coding task
is the narrow scoped image-result bridge and bounded capture manifest described
in [architecture.md](docs/architecture.md#first-product-dependency-image-delivery).
Prove a real QM turn sees intermediate frames, then follow
[plan.md](docs/plan.md) for inspection, real diagnosis/edit, repeat/compare,
case persistence, and rehearsal. There is no completed before/after repair or
measured full 90-second product demo yet.

Start with `npm start` and [administrator sign-in](docs/setup.md#sign-in-from-your-mac);
`npm run login` is for the Linux desktop. Use `npm run demo` for the target.
Read [demo.md](docs/demo.md#hand-the-server-to-qm) before handing the dev server
from operator control to QM's `background` tool. Stop retains containers/data;
only explicit demo reset creates a fresh target copy.
