#!/usr/bin/env node
// motion: bounded temporal browser evidence. Every command prints one JSON object.
import { CLI, UsageError, parseArgs } from './common.mjs';
import { SCENARIO_HELP } from './scenario.mjs';

const HELP = `usage: ${CLI} <command> [options]
  capture --scenario <file.json> [--label <label>] [--takes 3] [--before-ms 300] [--after-ms 800]
      Fresh takes of one interaction; prints takeIds.
  inspect <take-id> [--from <ms>] [--to <ms>] [--crop x,y,w,h]
      Table of watched-element changes (read first) + sheets holding every
      frame in the window (split automatically; view the one covering your
      moment). Times are ms from the trigger; negatives allowed.
  compare --before <id,id,id> --after <id,id,id> [--from <ms>] [--to <ms>] [--crop x,y,w,h]
      One table per take + sheets with one row per take (split into
      time slices automatically).
  video <take-id> | --before <take-id> --after <take-id> [--from <ms>] [--to <ms>] [--slow 4]
      MP4 for the user, built from the captured frames: real speed, then slow
      motion over --from/--to, with the cursor and a click marker, plus
      player.html that plays inline in chat. Attach both to your reply.
      For people only; analyse with inspect/compare.
  help scenario   annotated scenario format, to write one for any app
View any printed sheets[].path with the motion_view tool.
`;

const COMMANDS = {
  capture: () => import('./capture.mjs').then(m => m.capture),
  inspect: () => import('./inspect.mjs').then(m => m.inspect),
  compare: () => import('./compare.mjs').then(m => m.compare),
  video: () => import('./video.mjs').then(m => m.video),
};

const [command, ...rest] = process.argv.slice(2);
if (!command || command === 'help' || command === '--help') {
  process.stdout.write(rest[0] === 'scenario' ? SCENARIO_HELP : HELP);
  process.exit(0);
}

let result;
try {
  if (!COMMANDS[command]) throw new UsageError(`unknown command ${command}`);
  result = await (await COMMANDS[command]())(parseArgs(rest));
} catch (e) {
  result = { ok: false, error: e.message, ...(e.partial ?? {}),
    ...(e instanceof UsageError || e.usage ? { usage: HELP } : {}) };
}
console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
