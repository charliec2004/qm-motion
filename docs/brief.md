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
- Short captures, roughly 3–10 seconds, from Chrome's raw screencast through
  Playwright (measured choice; see [architecture.md](architecture.md#capture-measured)).
  FFmpeg builds bounded sheets and aligned before/after evidence.
- One real interaction defect: Field Notes reproduces historical Radix
  accordion issue #1074, pinned and verified in [demo.md](demo.md).
  The agent investigates its actual code. No inserted demo defect or hard-coded
  diagnosis.
- One GBrain source/client for this project, reached over authenticated HTTPS
  through its thin CLI. Cases contain reproduction, revision, observations,
  fix, verification, and durable evidence references.
- A 60–90 second demonstration within the September 27, 2026,
  1:15–5:00 PM Pacific build window (225 minutes).

## Terms

Every doc uses these words in exactly these senses.

| Term | Meaning |
| --- | --- |
| **QM** | The agent platform we extend: chat, agent, permissions, computers. |
| **Agent** | QM's coding agent: the `pi` harness running OpenAI `gpt-6-sol`. |
| **Turn** | One user message plus the agent's entire reply, which may include many tool calls. |
| **Computer** | The QM-managed Docker container where the agent runs commands. Chromium and the target app run there too; files live under `/root/workspace`. |
| **Target** | The app under investigation. For the MVP, Field Notes ([demo.md](demo.md)). |
| **Scenario** | A saved data file describing one interaction: URL, viewport, when the page is ready, what to click, and how long to record afterwards. |
| **Trigger** | The user action a take is aligned to, such as the click. Times are given in ms from the trigger. |
| **Take** (or **run**) | One recording of a scenario from a fresh page. Each has a run ID and a folder `artifacts/motion/<run-id>/`. |
| **Frame** | One screenshot Chrome delivers during a take, with Chrome's own timestamp. |
| **Manifest** | The take's record of what was captured and how: app revision, browser version, viewport, trigger time, timing source, file hashes. |
| **Sheet** | One small PNG grid of frames from a chosen window (and optional crop), labelled in ms from the trigger. This is what the model looks at. |
| **Rebound** | The Field Notes defect: while closing, the answer panel pops fully open again for exactly one frame, then disappears (Radix issue #1074). |
| **`motion_view`** | The QM tool we add. It hands a sheet to the model as an actual image, not a file path. |
| **Case** | A short GBrain record of one investigation: request, reproduction, observations, fix, verification, evidence paths. |

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
