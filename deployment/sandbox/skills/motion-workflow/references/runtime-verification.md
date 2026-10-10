# Operator verification: automatic checks and interim findings

This is a verification brief for the integrating operator, not a claim of
deployed or live-tested behavior. Do not restart services or reset targets
merely to follow this file. Use an authorized scratch application and retain
its evidence separately from existing work.

## Existing runtime flow

Inspected QM reference commit `1562826691680bff053c47347e88f032c336d84f`:

- `src/skills/materialize.ts`, `skillsIndex`: the system prompt receives the
  skill's name and description, not its complete body. The description must
  therefore advertise the automatic trigger. `skills` action `read` loads
  the actual guidance; the description is guidance, not an enforced hook.
- `src/resolution/protocols/mode-conversation.md`: ordinary assistant text
  streams to the current user. `src/core/orchestrator.ts`, `onDelta` and
  `onTextBlockStart`, publish text and block boundaries during a turn.
- `src/harness/agent-tools.ts`, `attach`: calls `tc.attach`, reports staged
  files, and explicitly delivers them when the turn ends. Calling it early
  does not deliver an image during investigation.
- The same file's surface tool supports `post` with `files` through
  `tc.post`, when `surfaceTools` is enabled. The exposed tools select either
  that surface tool or `attach`. Do not assume a web turn exposes `post`.
- The tracked `motion-evidence-image.patch` gives the model image pixels;
  `motion_view` does not deliver a user attachment.

## Implemented runtime change

`deployment/runtime/patches/motion-interim-attachments.patch` adds opt-in
`attach` parameter `delivery: "immediate"`. On ordinary web turns it registers
files with the existing current-conversation audience grants, then returns
confirmed artifact metadata through the recorded live tool result. It does
not stage those files for the closing reply or expose destination selectors.
Ordinary `attach` calls retain their existing staging/replacement behavior;
unsupported surfaces and missing artifact registration reject the opt-in.

The paired web UI overlay uses
`deployment/runtime/interim-attachments/apply-web-ui.mjs` to promote only
successful immediate attach results into the active assistant's file renderer,
before the terminal-run gate. Both SSE and polling use that handler. Final
reply files merge with interim evidence. The script verifies the shipped
bundle's exact checksum and rewrites the JS/CSS asset graph and gzip files
with new URLs so cached modules cannot retain the old handler. The exact
base digests, isolated test command and live check procedure are in
`deployment/runtime/interim-attachments/README.md`.

Both core and web UI overlays must be built and deployed together, along
with this skill. Fourteen isolated checks passed against source extracted from
the immutable image and the actual compiled web handler; these cover tool
forwarding, immediate/queued semantics, failure boundaries, live promotion,
final preservation and the asset graph. They use mocked file collection and
stream helpers and do not prove browser delivery, ACL enforcement or agent
workflow completion. See `PROGRESS.md` for the integrating operator’s deployment and live results.

## Focused acceptance checks after integration

1. In a fresh ordinary coding conversation, ask for an animated menu change
   without mentioning motion or recordings. Check the skill was loaded from
   its current deployed source and the affected open/close interactions were
   captured and viewed before completion. Retain actual take IDs and tools.
   Confirm unrelated interactions were not captured.
2. In separate fresh conversations, request a text-only change and request
   an animation change with an explicit "skip recordings for this task".
   Neither should capture. The latter must state that motion was unchecked.
   A subsequent explicit inspection request should capture normally; an
   earlier scoped opt-out must not become a permanent prohibition.
3. With an unavailable scratch app URL, confirm the agent reports the app as
   unavailable and the interaction as unchecked. It must not claim a pass
   from a failed command or screenshot. Do not stop shared services to test.
4. Investigate a real observed temporal defect. Verify an understandable
   finding appears after table/sheet inspection and before the first repair
   command. Its explanation must be provisional; its attached viewed image
   must render while the same run is still active to pass interim visual
   delivery. A staged attachment only passes final delivery, not this check.
5. If a candidate is rejected by fresh recordings, check the next update
   describes the observed failure and revised plan. Do not manufacture a bad
   production change to force this case; use a naturally rejected candidate
   or report this branch untested. Final attachments must come from the
   comparison of the original baseline with the retained fix, with all take
   results and warnings accounted for.
6. For newly built clean UI without a baseline, verify it reports current
   behavior and limitations rather than claiming an improvement. Existing
   separate Before/After players remain valid for repairs until the new
   comparison player is integrated.

## Additive instruction when the comparison player lands

Replace only the final delivery paragraph with the integrated command's
actual JSON contract: attach its reported comparison-player path from the
final retained-fix compare, identify the Before and After sides and where to
look, and report its timing/alignment limitations. Prefer that single player
when present; retain `video.attach` Before/After files as the compatibility
fallback when absent. Do not guess a future JSON field name. Preserve interim
sheet findings, vision checks and rejected-fix reporting.
