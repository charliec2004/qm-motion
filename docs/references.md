# References and provenance

Inspected September 27, 2026. `.upstream/` checkouts are ignored reference
material. Package lockfiles pin installed JavaScript dependencies; tracked
deployment configuration pins runtime images. A reference source commit does
not establish which image is running. [PROGRESS.md](../PROGRESS.md) records live
checks, and [demo.md](demo.md) owns the target revision and reproduction.

## Pins and reuse

| Project | Inspected source commit / installed version | License and use |
| --- | --- | --- |
| [QM](https://github.com/yc-software/qm) | `1562826691680bff053c47347e88f032c336d84f`; CLI `@yc-software/qm@0.1.12` | MIT; runtime/CLI, generated deployment scaffold, and execution daemon used. [Notice](licenses/qm.txt). Two small environment patches apply to the pinned runtime image below; the `motion_view` image tool patch remains unimplemented. |
| [GBrain](https://github.com/garrytan/gbrain) | `e78f1c38b947b053f3a46881340f74f316be855a`; binary `0.59.0.0` | MIT; separate server and thin CLI client. [Notice](licenses/gbrain.txt). |
| [agent-browser](https://github.com/vercel-labs/agent-browser) | `d01253d9db28d75080e36da3c1c31ef89454731e`; npm `0.38.1` | Apache-2.0; installed for ad-hoc exploration only; not the capture primitive. [License](licenses/agent-browser.txt). No vendored recorder fork. |
| [T3 Code](https://github.com/pingdotgg/t3code) | `ab099178a7b7f9728843e90fc95ed90bb61d710d` | MIT; implementation reference only, no code copied. |
| [Flowcard](https://github.com/newsbubbles/flowcard) | `d74d057e19058d732fc0121968daec348c058496` | No license file found at this revision; conceptual reference only, no code copied. |
| [motion-contact-sheet](https://github.com/Kallin/motion-contact-sheet) | `198ee77d61b21448e2fbbe7c391aedbbeba24ca7` | MIT; implementation reference only, no code copied or package installed. |
| [web-motion-skill](https://github.com/Schmandarine/web-motion-skill) | `74b7359277140f518cd33be224e6f86c158b629a` | README says MIT, but no license file found; conceptual reference only, no code copied. |
| [Matt Pocock skills](https://github.com/mattpocock/skills) | `c55ee46073ed923f86ce59a5eb3b6d895095d1b7` | MIT; four selected skills copied project-locally. [Notice](licenses/mattpocock-skills.txt). |
| [Playwright](https://github.com/microsoft/playwright) | npm `1.63.0` | Apache-2.0; the capture primitive (CDP screencast through Playwright) and browser automation. Use stock installed Chromium, not an assumed bundled browser. |
| [Radix primitives](https://github.com/radix-ui/primitives) | `2107c0e488247972a06be4248e5c98875f8e8aaa`; `@radix-ui/react-accordion@0.1.5` | MIT; unchanged published dependency in original minimal target app. [Notice](../demo/LICENSE.radix). |

The target also pins `react` and `react-dom` to `18.0.0-rc.0` in its own
lockfile. It reproduces the historical upstream [accordion animation
issue #1074](https://github.com/radix-ui/primitives/issues/1074); it is not a
claim about current Radix releases. No third-party reproduction app is copied.

QM CLI 0.1.12's shipped `manifest.json` selects these immutable base image digests:

| Image | SHA-256 |
| --- | --- |
| `ghcr.io/yc-software/qm/core` | `8859f0debbd5c6de2166c64bde18797c48ae638dd320de5861c0a5e36ddaff64` |
| `ghcr.io/yc-software/qm/web-ui` | `746ca51bb2dcb4d9d7295d57bfe7b4868c8aecb30f30bafc80fc9573e358be99` |
| `ghcr.io/yc-software/qm/admin` | `3e62508338529d03262a5f331bf3d16e712990c54f83bc753527aeae19ea0325` |
| `ghcr.io/yc-software/qm/portal` | `e7a6eb83acb828c3dbd68b2514986218f2946dbd3bf1d563f768eb26e1d8457a` |
| `ghcr.io/yc-software/qm/auth` | `6a7f59003e36488d5f3e1dfb066272edaf56d5981e53583d74346ffa51522b3f` |
| `ghcr.io/yc-software/qm/sandbox-base` | `9c632c8359eb41a626880b4669328c8fbe2fe7e7d38b99e5cc37fd389c2d04ab` |

The actual core is built by `qm up --build-from runtime` from
[deployment/runtime/deploy/core/Dockerfile](../deployment/runtime/deploy/core/Dockerfile).
This is a small image-overlay build context, not a copied QM source tree.
Its exact patch base is the core image digest above; the recorded reference
source also exhibits the environment omission. The tracked
[patch](../deployment/runtime/patches/local-core-address.patch) adds
`QM_CORE_CONTAINER` to `localSandboxEnv` in `src/config.ts`; upstream put the
field only in the AWS environment. Without it, core could not reach the local
Docker computer's execution daemon. The patch applies with `git apply --check`
in the image and the rebuilt running core passed real agent execution.
Other overlay Dockerfiles are unchanged `FROM` references to the original
web-ui, auth, and portal images. This environment correction does not implement
the `motion_view` image tool.

The second [patch](../deployment/runtime/patches/model-request-retry.patch) sets
Pi's supported `retry.provider.timeoutMs=60000` and `maxRetries=1` in QM's
in-memory settings. Installed `@earendil-works/pi-coding-agent` and
`@earendil-works/pi-ai` are
both 0.82.0. Its exact base is the same core digest; original
`src/harness/pi-harness.ts` SHA-256 is
`4164a212595161ce14335d23f68336c5e1b6b270865f879807bef0bc536f5573`.
The adapter retries the current provider request before response headers,
not completed tools. Outer session retries remain unchanged. This replaces
the observed five-minute, zero-provider-retry wait with bounded attempts;
it does not establish the remote cause of the intermittent stalls.

The supported QM administrator model registry loads
[deployment/model-gpt-6-sol.json](../deployment/model-gpt-6-sol.json) because
the CLI 0.1.12 image's built-in catalog predates this model. The reference main
source includes it. Registration uses the existing `gpt-5.5` integration
template with actual provider/model ID `openai` / `gpt-6-sol`; real generation
verified the result. Metadata follows the official
[GPT-6 Sol model reference](https://developers.openai.com/api/docs/models/gpt-6-sol.md)
inspected September 27, 2026.

Support images are pinned in [compose.yaml](../deployment/compose.yaml):
`pgvector/pgvector:pg16@sha256:ccc6e83d6e35e931dc7c5def2022729d5a6c370318d099181995567ff1fb4d6b`
and `caddy:2.10.2@sha256:c3d7ee5d2b11f9dc54f947f68a734c84e9c9666c92c88a7f30b9cba5da182adb`.
[gbrain.Dockerfile](../deployment/gbrain.Dockerfile) pins its Debian base.
Chromium and FFmpeg come from the sandbox's Debian packages; the verified
computer has Chromium `154.0.8037.57`. Smoke evidence records installed
versions, a PNG, a 3.1-second recording, and a contact sheet. Debian package
versions are not frozen merely by pinning the base image.
Installed packages were `chromium=154.0.8037.57-1~deb12u1` and
`ffmpeg=7:5.1.9-0+deb12u1`; the verified local sandbox image ID is
`sha256:af06919e3fa18aeade666c90c0a438db7d01af276f8321b10aafa3cf5ff5e3d0`.

## Findings that inform the implementation

- **QM:** inspected `deployment.md`, `cli/README.md`,
  `docs/deploy-directory.md`, `docs/sandbox-resources.md`,
  `docs/memory-providers.md`, `src/sandbox/local-sandbox.ts`, scaffold/config,
  sandbox Dockerfiles, and pi tool delivery. Docker deployment target alone
  does not select the computer backend: configure `sandbox.backend: local`.
  A sandbox needs the execution daemon as well as browser binaries. The
  `skills-seed/browse/SKILL.md` remote-browser workflow is not our capture path.
  The deployed `read` tool is text-only; the proposed `motion_view` patch is
  in [architecture.md](architecture.md). No complete bundled equivalent of
  our intended reproduce/inspect/edit/compare loop was established in this
  scoped source review.
- **GBrain:** [QM integration guide](https://github.com/garrytan/gbrain/blob/e78f1c38b947b053f3a46881340f74f316be855a/docs/integrations/qm-harness.md)
  and [memory protocol](https://github.com/garrytan/gbrain/blob/e78f1c38b947b053f3a46881340f74f316be855a/docs/protocol/MEMORY_VERBS_v1.md)
  establish separate HTTP service, OAuth thin clients, source-level reads,
  and prefix-fenced writes. We use one project source/client, without a
  redundant QM memory-provider route or organization provisioning system.
- **T3 Code:** `apps/server/src/mcp/toolkits/preview/tools.ts:223` and
  `handlers.ts:217` define start/stop and explicitly transfer recording
  evidence into the agent environment. Useful delivery ergonomics; its
  Electron/desktop architecture is not adopted and a recording path alone
  does not prove model vision.
- **agent-browser:** [recording documentation](https://agent-browser.dev/recording)
  and `cli/src/native/recording.rs` provide FFmpeg-backed recording, cursor
  overlays, timestamped contact sheets, and changed-region selection. It stays
  installed for exploration, but measurement showed its fixed-rate video
  discards Chrome's frame timestamps, so it is not our capture primitive
  ([architecture.md](architecture.md#capture-measured)).
- **Flowcard:** `server.py`, `flowcard/card.py`, and `flowcard/compare.py`
  informed interval/region inspection and paired filmstrip presentation.
  Its comparison assumes the same scene start/FPS; our manifest must instead
  make trigger alignment and mismatches explicit. Desktop capture and broad
  OpenCV analysis are not adopted.
- **motion-contact-sheet:** `scripts/capture.mjs` and `build-sheet.mjs` show
  labeled burst frames, change-based selection, crop, and endpoint density.
  Its optional slowdown changes playback and must never be presented as
  native timing. Native speed is the MVP default.
- **web-motion-skill:** recording/extraction/contact-sheet/compare scripts
  informed small visual evidence and region selection. No entire skill or
  analyzer framework is copied.
- **Playwright:** the official [Screencast API](https://playwright.dev/docs/api/class-screencast)
  supports video and timestamped frame callbacks; [Trace Viewer](https://playwright.dev/docs/trace-viewer)
  supplies action/DOM context. Our `motion capture` uses Playwright's
  CDPSession to read the raw screencast directly.

## Skills and original work

Only `improve-codebase-architecture`, `codebase-design`, `grilling`, and
`domain-modeling` are copied from Matt Pocock's repository. The latter three
are referenced by the requested architecture skill. Preserve its supporting
files and relative links. The full catalog and issue-tracker setup ceremony
are not installed. Architecture review is an optional developer aid.

Developer skills live in `.agents/skills/`, with relative `.claude/skills/`
links for Claude Code. Discovery follows [Codex skill documentation](https://learn.chatgpt.com/docs/build-skills)
and [Claude Code skills](https://code.claude.com/docs/en/skills). Root
`CLAUDE.md` links to `AGENTS.md`. These developer paths do not install skills
into QM computers; deployment runtime skills are separate.

What existed at the start of the build window is listed in
[starting-point.md](starting-point.md). Our original work is the project
instruction/docs set, environment scripts and
configuration, local service integration, two project workflow skills, and the
minimal Field Notes target app, plus the two small QM environment patches.
The capture/inspect/compare extension remains
planned. Any future copied code or QM patch must add its source, exact base
revision, license notice, and deployment verification here.
