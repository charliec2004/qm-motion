import { readFileSync } from 'node:fs';
import { client, turn } from './qm-session.mjs';
const text = process.argv[2] === '--file' ? readFileSync(process.argv[3], 'utf8') : process.argv.slice(2).join(' ');
if (!text) throw new Error('Pass a message or --file <prompt>');
const api = await client();
try {
  const result = await turn(api, text);
  console.log(JSON.stringify({ status: result.status, result: result.result, elapsedMs: result.elapsedMs }, null, 2));
} catch (error) {
  console.error(String(error.message).split('Call log:')[0]);
  process.exitCode = 1;
}
finally { await api.dispose(); }
