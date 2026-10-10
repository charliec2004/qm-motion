# Immediate attachments for issue #4

Implemented and isolated-tested. Integrated deployment and real agent/browser
verification status are recorded in `PROGRESS.md`; the checks below distinguish
stream propagation from actual image rendering.

## Version and ownership

QM CLI `@yc-software/qm@0.1.12`, MIT (existing notice in `docs/licenses/qm.txt`).
Reference source `1562826691680bff053c47347e88f032c336d84f` was inspected but
**is not the patch base**. Both implementations target extracted immutable
shipped image files, without using the primary checkout's private-memory work.

- Core base: `ghcr.io/yc-software/qm/core@sha256:8859f0debbd5c6de2166c64bde18797c48ae638dd320de5861c0a5e36ddaff64`.
  `motion-interim-attachments.patch` applies in filename order after the
  existing environment, retry and evidence-image patches. It changes only
  `src/core/orchestrator/attach-tool.ts`, `src/core/orchestrator.ts`,
  `src/harness/agent-tools.ts`, and `src/tools/primitives.ts`.
- Web UI base: `ghcr.io/yc-software/qm/web-ui@sha256:746ca51bb2dcb4d9d7295d57bfe7b4868c8aecb30f30bafc80fc9573e358be99`.
  Shipped `dist-web/assets/main-bxZ5CHIJ.js` SHA-256:
  `787a31d98c9213ccf0aa25b0d1541aab0f588e9170b589369c6f9b1e03e81279`.
  The image lacks frontend source/build tooling. The small, fail-closed
  `apply-web-ui.mjs` edits the exact compiled `core-bridge.ts` `applyRun`
  handler (`Zy`), shared by SSE and polling, its final-files assignment,
  and retained transcript replay (`di`).
  This stays within the pinned image overlay; it does not rebuild a newer QM.
  The web UI Dockerfile runs it during the overlay build. It versions the
  entire JS/CSS module graph, rewrites imports, recompresses gzip siblings and
  updates the entry HTML. Versioning only the main asset would break circular
  imports from cached provider chunks. A future upstream version requires a
  new reviewed source seam and checksum, rather than bypassing this guard.

Original core-file SHA-256 values before any overlays:

```text
395d42bcb99137d019b294d052d0b13fbdb1167a94a6bd49fd795a48b1da50b7  src/core/orchestrator/attach-tool.ts
cf3de48340161d844236247f789ff5f9ce87eee4d0892064ca50b0550ca347c1  src/core/orchestrator.ts
4399ab1b06493cd856c0fc06fd42c9681778e50c0874aabc604e34cddbb8c453  src/harness/agent-tools.ts
d8be5e4abbb6d6534863435ceb647ecce4e53406e846415ba55c93f36faf0b6f  src/tools/primitives.ts
```

## Contract

`attach({files: ["relative/sheet.png"], delivery: "immediate"})` is available
only in ordinary writable web conversations. It uses existing workspace file
collection, artifact registration, audience grants, limits and authenticated
current-run activity delivery. There are no recipient/channel/thread selectors,
no `reach` call and no new external audience. The successful recorded tool
result has `tool: "attach", ok: true, delivery: "immediate", files: [...]`.
The web renderer promotes only confirmed artifact-backed files with that
marker during the active run. The same result remains in transcript history.
The bridge publishes an empty stream delta when immediate files change, so the
stream consumer refreshes its shallow message copy without changing text.
Immediate files do not replace or discard queued files, and do not appear
again as closing-reply attachments. A final reply's files merge with interim
files on the active bubble. Repeated snapshots dedupe by artifact ID.
Transcript replay checkpoints immediate files separately from ordinary staged
files. A reload during the active turn keeps queued files hidden; the closing
reply retains them, and its delivery event merges by artifact ID without
duplicating them. Name-based replacement of ordinary staged files is preserved.

Omitting `delivery`, or setting it to `reply`, preserves normal staging,
replacement and end-of-turn behavior. Registration failures and unsupported
surfaces fail explicitly. The tool's response confirms registration and live
stream availability; it is not a browser receipt. Actual rendered pixels must
be checked live before declaring issue #4 complete.

## Isolated checks

Extract `/app/src` from the core image into an isolated directory, apply all
`deployment/runtime/patches/*.patch` in filename order with `git apply --check`
before each apply. Extract `/app` from the web UI image into another isolated
directory. Never copy a running core or another worktree's patched source as
the base. Temporary containers need only `docker create`, `docker cp` and
`docker rm`; never start them. Then run (Node with TypeScript stripping and
experimental module mocks, tested with Node 25.1.0):

```bash
TMPDIR=/tmp QM_CORE_SOURCE=/tmp/<patched-core> QM_WEB_ROOT=/tmp/<pinned-web> \
  node --experimental-test-module-mocks \
  deployment/runtime/interim-attachments/interim-attachments.test.mjs
```

14 checks passed using `/tmp/qm-motion-interim-sequence-check` and
`/tmp/qm-motion-interim-web-base` with the command above. The tests run the
actual patched core staging module and attach tool, with mocked file
collection/transfer, then the actual pinned web
bundle's modified `applyRun`, with stream helpers stubbed. They check the
immediate/default modes, staged-file preservation, path/count/failure bounds,
failed registration, live promotion through the shipped stream consumer before terminal completion, final-file
preservation and deduplication, checksum rejection, rewritten asset imports,
gzip equivalence, and transcript retention when filenames are reused. The
ordering regression replays ordinary `final.png` → immediate `interim.png` →
assistant finish → delivery, checks reloads before finish, and requires one
interim checkpoint followed by exactly one final attachment. The filename
reuse regression includes the closing assistant entry, rather than treating
an active transcript's end-of-input as completion. These checks do not replace
live rendering/access verification.

## Integration and live verification

The parent integrates and builds both runtime overlays, deploys through the
normal authorized `npm start` path from the primary checkout, and verifies
that the updated sandbox skill is loaded. Core-only deployment cannot meet
interim visual delivery. Web-only deployment is inert until the option is used.

1. Start a fresh ordinary web conversation in an authorized scratch app. Ask
   the agent to inspect an existing temporal interaction, report its initial
   finding with an already-viewed sheet immediately, then continue examining
   the code. Keep a real subsequent command running long enough to observe the
   active run. Do not end the turn to flush the sheet.
2. Retain the tool sequence: capture → inspect/table → `motion_view` for that
   sheet → provisional assistant finding → `attach` with `delivery: immediate`
   → subsequent investigation/edit tool. Verify the PNG visibly renders
   before the subsequent command completes, with the run still working.
   Retain actual timestamps, take IDs, tool-result marker, and a screenshot
   of the rendered image plus active run state. A path/marker alone is no pass.
3. Check that the file uses the current conversation's artifact endpoint and
   existing audience ACLs. A second unrelated conversation must not receive
   this attachment or its event. Do not share private evidence to probe this.
4. In the same conversation, queue a separate final file with plain `attach`.
   Confirm it is absent during work and arrives at completion; the interim
   sheet remains visible and is not duplicated. Reload to check retained
   transcript rendering. Repeat with the live SSE connection interrupted to
   verify polling/reconnection, using the same scratch conversation.
5. Pass a nonexistent image and confirm a failed attach result and no rendered
   attachment. On a surface without immediate support, check rejection and
   ordinary attachment fallback without falsely claiming live delivery.
6. Run the motion skill's acceptance checks in
   `deployment/sandbox/skills/motion-workflow/references/runtime-verification.md`:
   automatic inspection, scoped opt-out, provisional findings, naturally
   rejected candidate reporting, and final comparison from the retained fix.
   Those model/workflow checks remain outstanding after these unit checks.
