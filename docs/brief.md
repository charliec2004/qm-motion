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

## In plain words

**QM Motion lets QM's coding agent see what happens on screen over time**, so
it can find and fix visual glitches that a single screenshot misses: flickers,
jumps, things that appear for a split second.

**What happens, from the user's side:**

1. You open QM in a browser (on your Mac, over Tailscale) and chat with the
   agent.
2. You describe the problem in words. For example: "When I close the first
   FAQ, the page blinks at the end. Find out why and fix it."
3. The agent investigates by itself:
   - it records the interaction several times;
   - it reads a short table of numbers, such as how tall the answer panel was,
     frame by frame;
   - it looks at grids of the actual frames to confirm;
   - it names the glitch: "the answer collapses, pops fully back open for one
     frame (+264 ms), then disappears."
4. The agent changes the code, records again, and compares before with after.
5. You get a reply with its explanation, the change, and before/after frame
   grids shown inline in the chat. It also saves a short case to memory
   (GBrain).

The demo is exactly this, on the Field Notes FAQ page and its real one-frame
accordion bug ([demo.md](demo.md)).

**What we build** (everything else already exists in QM):

1. **The `motion` command**, which runs in the agent's computer. The agent
   describes the interaction in a small scenario file: which page, what to do,
   which elements to watch. One command then does the rest.
   - **capture:** a fresh headless Chrome loads the page and performs the
     action. It records every frame Chrome's screencast delivers, with Chrome's exact
     timestamps, while a tiny in-page script logs the watched elements' size,
     position and visibility every frame.
   - **inspect:** turns one recording into a short text table (only moments
     where something changed) plus grids of every frame in a chosen time
     window, split across several images automatically.
   - **compare:** the same for before and after recordings, lined up on the
     action.
2. **`motion_view`**, a small addition to QM itself. The model normally gets
   only file paths; this hands it a grid as an actual picture, shrinking it if
   needed, so image size never causes a failure (only files over 50 MB are
   refused, a transfer limit).
3. **Instructions for the agent**, a QM skill: read the numbers first, confirm
   with the picture, record several times, compare after fixing, and report
   honestly.

**Why it works this way:**

- **Numbers first, pictures to confirm.** A table showing a height of 0.59 →
  76.78 → hidden is exact and cheap to read; the grid proves it visually.
- **Every frame, never sampled.** The glitch lasts one display frame (about
  1/60 s), so skipping frames could skip the bug.
- **One command performs the whole recording.** The same action repeats
  identically each time, with precise timing, which makes before and after
  fair to compare.

**Already proven:**

- Chrome's recording caught the one-frame glitch in 7 of 7 takes.
- GPT-6 Sol read a picture passed back through pi inside QM's core.

What remains is building the three pieces. The technical picture (your Mac →
Tailscale → QM on the Linux box → the agent's computer) is in
[architecture.md](architecture.md#the-system-in-one-picture). The order of work
is in [plan.md](plan.md).

## Committed MVP

- One QM harness: `pi`, with the user-selected OpenAI `gpt-6-sol` model.
  The supported administrator registry configures the model; real generation
  and agent command execution have passed.
- One local Docker agent computer with a durable workspace; stock Chromium and
  the application dev server run in that same computer.
- Short takes (about 1 second around the trigger), from Chrome's raw screencast through
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
| **Scenario** | A data file the agent writes describing one interaction: URL, viewport, when the page is ready, optional setup steps, the trigger (click, hover or press), elements to watch, and the record window. |
| **Trigger** | The user action a take is aligned to, such as the click. Times are given in ms from the trigger. |
| **Take** | One recording of a scenario. Each has a **take ID** and a folder `/root/workspace/artifacts/motion/<take-id>/` in the computer. (QM's own "run" is a separate thing: one agent turn's record.) |
| **Fresh take** | How every take starts: a new Chromium process, a new browser context and a fresh navigation. Not the same as a source reset. |
| **Source reset** | `npm run demo -- reset`: a new pristine copy of the demo app. Done once before a real investigation, never between before and after takes. |
| **Frame** | One screenshot Chrome delivers during a take, with Chrome's own timestamp. (A *display frame* is one screen refresh, about 16.7 ms; "a one-frame defect" means one display frame.) |
| **Sample** | One entry in the trace, taken once per display frame in the page. |
| **Watched element** | An element named in the scenario whose size, position and visibility are traced every frame. |
| **Trace** | The per-sample record of watched elements during a take (`trace.json`), timed on the page's own clock. `motion inspect` prints it as a short **table** of the samples where something changed. |
| **`motion capture`** (and `inspect`, `compare`) | Shorthand for `node /root/workspace/motion/cli.mjs capture …` in the computer. There is no `motion` executable. |
| **Manifest** | The take's record of what was captured and how: app revision, browser version, viewport, trigger time, timing source. |
| **Sheet** | One PNG grid of frames from a chosen window (and optional crop), labelled in ms from the trigger. A long window gives several sheets. The model reads the table first, then views sheets to confirm. |
| **Rebound** | The Field Notes defect: while closing, the answer panel pops fully open again for exactly one frame, then disappears (Radix issue #1074). |
| **`motion_view`** | The QM tool we add. It hands an image (usually a sheet) to the model as actual pixels, not a file path, shrinking it if needed. |
| **Case** | A short GBrain record of one investigation: request, reproduction, observations, fix, verification, evidence paths. |

## Acceptance criteria

1. A real QM turn starts a capture, then receives actual image content showing
   multiple moments. A video filename or PNG path in a text result is insufficient.
2. Evidence includes viewport, browser/version, application revision, reset
   state, interaction steps, action/frame timing, and capture limitations.
3. The agent inspects a relevant interval or region and correctly describes
   what happens on screen, citing trigger-relative times from the trace and
   the frames it viewed. This is the tool's job: making the problem visible
   and measurable.
4. The same interaction is repeated as fresh takes. Before/after views align
   to the interaction trigger and show whether the user's intended behavior is
   satisfied. Pixel differences report change, not quality.
5. The user sees durable, accessible evidence and an honest result, including
   failures or inconclusive takes. Recorded frame rate is not proof of smoothness.
6. A compact case is written to GBrain and retrieved in a fresh session. A memory
   failure is reported visibly and does not break capture, inspection, or reporting.

The prerequisite environment checks are distinct: authenticated model reply,
real agent command execution, browser screenshot/recording, identified vision
delivery path, durable scoped memory, service lifecycle, and clean private Git
repository. See [setup.md](setup.md) and [PROGRESS.md](../PROGRESS.md).

**Demo goal, not a tool requirement:** the agent also relates what it saw to
the application code, makes a justified change without being given the fix,
and shows the result with before/after takes. Whether it succeeds depends on
the model, not on the motion tools. See [demo.md](demo.md).

## Non-goals

No new agent framework, custom Chromium, chatbot, desktop app, dashboard,
multi-browser/device matrix, generalized visual testing platform, speculative
motion score, fine-tuning, automatic production deployment, or new memory
infrastructure. Optional releases belong in [roadmap.md](roadmap.md).
