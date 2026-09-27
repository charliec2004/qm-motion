# QM Motion brief

Give QM's coding agent the intermediate visual evidence needed to investigate a
web interaction, change the application, and verify the result. A final
screenshot can hide a panel jump, flicker, or control that disappears briefly.

The loop is **request → reproduce and capture → inspect → edit → repeat →
compare and report**. QM supplies the general coding agent, conversations,
permissions, durable computers, and user interface. Our extension supplies
bounded temporal evidence. GBrain retains concise evidence-backed cases for
later retrieval; capture and inspection must work when memory is unavailable.

This repository's kickoff establishes the development environment and project
foundation. The motion extension remains to be implemented. Actual checks and
blockers are recorded in [PROGRESS.md](../PROGRESS.md), rather than inferred from
the presence of a script or configuration file.

## Committed MVP

- One QM harness: `pi`, with the user-selected OpenAI `gpt-6-sol` model.
  The supported administrator registry configures the model; real generation
  and agent command execution have passed.
- One local Docker agent computer with a durable workspace; stock Chromium and
  the application dev server run in that same computer.
- Short captures, roughly 3–10 seconds, using `agent-browser`; FFmpeg packages
  bounded frames and aligned before/after evidence.
- One real interaction defect: Field Notes reproduces historical Radix
  accordion issue #1074, pinned and verified in [demo.md](demo.md).
  The agent investigates its actual code. No inserted demo defect or hard-coded
  diagnosis.
- One GBrain source/client for this project, reached over authenticated HTTPS
  through its thin CLI. Cases contain reproduction, revision, observations,
  fix, verification, and durable evidence references.
- A 60–90 second demonstration within the September 27, 2026,
  1:15–5:00 PM Pacific build window (225 minutes).

## Acceptance criteria

1. A real QM turn starts a capture, then receives actual image content showing
   multiple moments. A video filename or PNG path in a text result is insufficient.
2. Evidence includes viewport, browser/version, application revision, reset
   state, interaction steps, action/frame timing, and capture limitations.
3. The agent inspects a relevant interval or region, relates observations to
   application code, and makes a justified edit without being given the fix.
4. The same interaction is repeated from reset state. Before/after views align
   to the interaction trigger and show whether the user's intended behavior is
   satisfied. Pixel differences report change, not quality.
5. The user sees durable, accessible evidence and an honest result, including
   failures or inconclusive runs. Recorded frame rate is not proof of smoothness.
6. A compact case is written to GBrain and retrieved in a fresh session. A memory
   failure is reported visibly and does not break capture, inspection, or reporting.

The prerequisite environment checks are distinct: authenticated model reply,
real agent command execution, browser screenshot/recording, identified vision
delivery path, durable scoped memory, service lifecycle, and clean private Git
repository. See [setup.md](setup.md) and [PROGRESS.md](../PROGRESS.md).

## Non-goals

No new agent framework, custom Chromium, chatbot, desktop app, dashboard,
multi-browser/device matrix, generalized visual testing platform, speculative
motion score, fine-tuning, automatic production deployment, or new memory
infrastructure. Optional releases belong in [roadmap.md](roadmap.md).
