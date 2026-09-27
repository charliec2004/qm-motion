# Demo rehearsal runbook (Trailhead)

This is how to run and record the QM Motion demo from a clean state. QM's
coding agent adds an FAQ page to an existing storefront, a code review passes
it, and then a frame-by-frame motion check finds a real one-frame bug and fixes
it. The agent ends by showing Before and After videos in the chat.

**Framing, stated once in the demo.** The storefront (`targets/trailhead`, our
fixture) is pinned to an older UI library, `@radix-ui/react-accordion@0.1.5`,
and React `18.0.0-rc.0` with `createRoot`. It contains no accordion. The agent
writes the accordion and its animation itself; the bug is the library's real
behaviour ([Radix issue #1074](https://github.com/radix-ui/primitives/issues/1074))
together with that code. Nobody plants it or tells the agent about it.

## Before you start

- The environment is set up and running as described in [setup.md](setup.md)
  (`npm run status` shows every service up). You can sign in to QM at
  `https://charlies-pc.tail1d1ed7.ts.net`.
- **Run every command from the primary checkout**, which holds `node_modules`,
  `deployment/.env` and `.state/`. Git worktrees cannot run these commands;
  the scripts refuse and say so.
- One time only, publish the live view (tailnet-only):
  `sudo tailscale serve --bg --https=8443 http://127.0.0.1:15173`.

## 1. Reset to a clean slate

Earlier runs must leave nothing the agent could read, or the demo is no longer
"found unaided".

1. Back up and clear GBrain. Run this yourself (Claude Code's permission check
   blocks this delete):

   ```sh
   npm run -s computer -- bash -lc 'mkdir -p /root/demo-archive/gbrain && for s in $(gbrain list | cut -f1); do gbrain get "$s" > "/root/demo-archive/gbrain/$(echo $s | tr / _).md" && gbrain delete "$s" --force; done; gbrain list'
   ```

2. Prime everything else:

   ```sh
   npm run trailhead -- install
   ```

   It backs up and resets QM's per-user memory, which is injected into every
   agent turn, to the onboarding marker, archives every open QM session, and
   renames apps the agent published earlier to `rehearsal-archive-…` (QM's web
   API cannot archive them). It stops the previous run's background jobs.
   It moves all earlier-run files out of the agent computer to
   `artifacts/rehearsal-archive/<time>/`, installs a fresh
   `/root/workspace/trailhead-storefront` with one Git commit, and runs a leak
   scan. It must end with:

   ```text
   Leak scan: no earlier-run files in the agent computer.
   GBrain: no pages.
   QM memory: onboarding marker only.
   QM sessions open: 0
   QM published apps from earlier runs: 0
   ```

   Run the GBrain step first: the backup it writes inside the agent computer is
   swept out by `install`.

   `npm run trailhead -- scan` repeats only the check.

3. Start the live view: `npm run preview -- start`. Open
   `https://charlies-pc.tail1d1ed7.ts.net:8443/` on your laptop. It says "No
   dev server" until the agent starts the app. `npm run preview -- status`
   shows its state.

## 2. Run the three prompts

In QM, click **New session** first; the page may reopen the last, archived
chat. All three prompts go in that one session, and each waits for the
previous reply.

**Prompt 1: build**

```text
Hey, picking up a ticket from our PM: we need an FAQ page on the Trailhead storefront. We're still on the old design system until the platform team migrates everything next quarter, so stick to the approved packages and versions in CONTRIBUTING.md, no new libraries and no upgrades.

Five questions (shipping, returns, sizing, warranty, gift cards), first one open by default, only one open at a time, and they should animate open and closed smoothly. Link it from the footer. Keep the dev server running so I can look at it, and commit when you're done.

Don't run any motion recordings yet, I want to do a code review pass with you first. Just get it standing up.
```

**Checkpoint.** When the reply arrives, run `npm run trailhead -- probe`. Add
the page URL if it is not `http://localhost:5173/faq`. It records closing the
open question 3 times from outside the agent's workspace and deletes the
recordings afterwards. Expect `REBOUND at +2xx ms` in 3/3. If it says
`no rebound`, the agent wrote an animation without the bug (for example
`animation-fill-mode: forwards`). Reset and run again; do not reword the
prompts to steer it.

**Prompt 2: code review**

```text
Nice. Before this goes to the PM, can you do a proper code review? Correctness, accessibility, and whether the accordion animation is implemented properly. Copy is placeholder, so don't worry about wording. Just read through the code and make sure the page loads; still no motion recordings for this pass. Is it good to ship?
```

Expect the review to pass the animation. It may flag unrelated issues, such as
the page title in the September 27 run.

**Prompt 3: motion check**

```text
OK, now you can use the motion tool. Last release a visual bug slipped past code review, so record the accordion closing and check it frame by frame. Take a few recordings of closing the first question. If anything's off, figure out why and fix it. If it turns out to be the library, an upgrade is fine, I'll clear it with the platform team. Keep the animation and keyboard support, and show me before and after.
```

Expect a reply that cites the rebound with trigger-relative times, a committed
fix, and two inline videos labelled Before and After. It takes about 4 minutes.

**Verify independently** rather than trusting the reply:

- `npm run trailhead -- probe` now prints `no rebound` in 3/3;
- `npm run -s computer -- bash -lc 'gbrain list'` shows the new case;
- the agent's first attempted fix may have failed. Its takes stay in
  `/root/workspace/artifacts/motion/` if you want to show that beat.

## 3. Record and present

Record the run on your laptop (on a Mac, Cmd+Shift+5) with two tabs: the QM
chat and the live view at `:8443/faq`. Cut it to 60–90 seconds:

1. Hook: code review and screenshots miss bugs that happen between frames.
2. Build, sped up: prompt 1 and the page appearing in the live view.
3. The review passes the animation (quote its line).
4. The motion check finds the one-frame rebound (quote the numbers).
5. Before and After videos play in the chat.
6. Close: found, fixed and proved without being told.

Honesty rules: label the video as a recorded real run, and label any sped-up
or slowed-down part. Say "verified across three fresh recordings", not
"smooth". Never imply the bug was unknown to the people setting up the demo.

## 4. Reset for the next run

Repeat section 1. The previous run's app, recordings, chat and memory are
archived under `artifacts/rehearsal-archive/`.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Cannot find package 'playwright'` or "Run this from the primary checkout" | You are in a Git worktree; `cd` to the primary checkout. |
| The leak scan lists files | Read them; if they come from earlier runs, run `install` again. |
| `GBrain is not empty` | Run the GBrain command in section 1. |
| The live view says "No dev server" | The agent has not started it yet, or its background job ended. Ask it to start the dev server. |
| QM shows an old conversation | Click **New session**; archived chats can reopen. |
| Probe says `INCONCLUSIVE` | The page has no open accordion question at that URL; pass the right URL. |

Known residue: QM keeps files attached in earlier runs in its file store, with
no supported way to delete them. The agent has no listing of them.

## Where things live

- `targets/trailhead/`: the storefront fixture (agent-facing README and
  CONTRIBUTING).
- `scripts/trailhead.sh`: `install`, `scan`, `probe` and `status`.
- `scripts/prime-qm.mjs`: QM memory reset and session archiving.
- `scripts/preview.sh` and `scripts/preview-proxy.mjs`: the live view.
- `deployment/sandbox/skills/motion-workflow/SKILL.md`: the agent's motion
  guidance, deployed by `npm start`.
- `src/motion/`: the motion CLI, copied into the agent computer
  ([spec §3](spec.md#3-development-loop-for-the-motion-cli)).
