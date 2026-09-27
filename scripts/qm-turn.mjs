import { readFileSync } from 'node:fs';
import { client, turn } from './qm-session.mjs';
const usage = 'usage: node scripts/qm-turn.mjs --thread <name> [--timeout <seconds>] (<message> | --file <prompt>)';
const args = process.argv.slice(2);
let thread, timeoutSec = 240, file;
while (args[0]?.startsWith('--')) {
  const flag = args.shift();
  if (flag === '--thread') thread = args.shift();
  else if (flag === '--timeout') timeoutSec = Number(args.shift());
  else if (flag === '--file') file = args.shift();
  else { console.error(`unknown flag ${flag}\n${usage}`); process.exit(2); }
}
const text = file ? readFileSync(file, 'utf8') : args.join(' ');
if (!thread || !text || !(timeoutSec > 0)) { console.error(usage); process.exit(2); }
const api = await client();
try {
  const result = await turn(api, text, { threadRef: `web:charlieconner04@gmail.com:${thread}`, thinkingLevel: 'low' },
    { timeoutMs: timeoutSec * 1000 });
  console.log(JSON.stringify({ status: result.status, result: result.result, elapsedMs: result.elapsedMs }, null, 2));
} catch (error) {
  console.error(String(error.message).split('Call log:')[0]);
  process.exitCode = 1;
}
finally { await api.dispose(); }
