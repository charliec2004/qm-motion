import { readFileSync, writeFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { client, turn } from './qm-session.mjs';
const phase = process.argv[2];
const api = await client();
const threadRef = `web:charlieconner04@gmail.com:smoke-${phase}-${Date.now()}`;
const options = { threadRef, thinkingLevel: 'low' };
function requireReply(result) {
  if (result.status !== 'done' || result.result?.status !== 'ok') throw new Error(`QM ${phase} did not complete successfully.`);
  return result.result.reply;
}
async function waitForPark() {
  // The run API can finish before asynchronous local-computer teardown. These
  // smoke turns deliberately own no background job; wait for actual parking
  // before operator Docker access, which otherwise races `docker stop -t 2`.
  const name = execFileSync('python3', ['scripts/computer.py', '--name'], { encoding: 'utf8' }).trim();
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const running = execFileSync('docker', ['inspect', '--format', '{{.State.Running}}', name], { encoding: 'utf8' }).trim();
    if (running === 'false') return;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('Computer did not park after the smoke turn; inspect other turns/background jobs before operator access.');
}
try {
  let result;
  if (phase === 'command') {
    result = await turn(api, 'Skip onboarding. Use execute to generate a fresh UUID with Python uuid.uuid4(), write it to /root/workspace/qm-computer-proof.txt, read it back, and report the exact UUID. Do not call sandbox status or restart: this local backend does not support those actions. Do not read credentials.', options);
    const reply = requireReply(result);
    await waitForPark();
    const actual = execFileSync('python3', ['scripts/computer.py', 'cat', '/root/workspace/qm-computer-proof.txt'], { encoding: 'utf8' }).trim();
    if (!/^[0-9a-f-]{36}$/.test(actual) || !reply.includes(actual)) throw new Error('Agent UUID did not match independent computer read.');
  } else if (phase === 'vision-memory') {
    const bytes = readFileSync('artifacts/smoke/browser/visual.png');
    const sha = createHash('sha256').update(bytes).digest('hex');
    const response = await api.post('/api/blobs?sha=' + sha, { data: bytes, headers: { 'content-type': 'image/png' } });
    if (!response.ok()) throw new Error(`Image upload HTTP ${response.status()}`);
    const blob = await response.json();
    const marker = 'qmmotion' + randomUUID().replaceAll('-', '');
    const slug = 'cases/environment-' + randomUUID();
    writeFileSync('artifacts/smoke/memory-case.json', JSON.stringify({ marker, slug }));
    result = await turn(api, `Skip onboarding. Inspect the attached image directly and report the six-digit visual code and the three shapes/colors from left to right. Do not read files or metadata to answer the visual question. Then use execute to run gbrain put ${slug} --content with a concise Markdown case titled QM Motion environment proof containing unique token ${marker}, reproduction: neutral local Chromium page, result: recording completed, artifact: /root/workspace/artifacts/environment-smoke/neutral.webm. Run gbrain get ${slug} to confirm. Use the existing scoped client and never inspect credentials. Report actual results separately.`, { ...options, attachments: [{ name: 'visual.png', mimetype: 'image/png', sizeBytes: bytes.length, blobId: blob.blobId }] });
    const reply = requireReply(result).toLowerCase();
    await waitForPark();
    const expected = JSON.parse(readFileSync('artifacts/smoke/browser/metadata.json')).visualCode;
    if (![expected, 'blue', 'circle', 'red', 'square', 'green', 'triangle'].every(value => reply.includes(value)))
      throw new Error('Incoming image visual challenge failed.');
    const stored = execFileSync('python3', ['scripts/computer.py', 'gbrain', 'get', slug], { encoding: 'utf8' });
    if (!stored.includes(marker)) throw new Error('Independent GBrain read did not match the written marker.');
  } else if (phase === 'retrieve') {
    const { marker, slug } = JSON.parse(readFileSync('artifacts/smoke/memory-case.json'));
    result = await turn(api, `Fresh memory persistence check after restarting GBrain and PostgreSQL. Skip onboarding. Use execute to run gbrain get ${slug}. Report its stored unique token and artifact path exactly, then use gbrain search for the retrieved token. Report whether search actually found it. Do not infer content from the slug or inspect credentials.`, options);
    const reply = requireReply(result);
    await waitForPark();
    if (!reply.includes(marker)) throw new Error('Fresh-turn durable memory retrieval failed.');
    const search = execFileSync('python3', ['scripts/computer.py', 'gbrain', 'search', marker], { encoding: 'utf8' });
    if (!search.includes(marker)) throw new Error('Independent GBrain search did not return the case.');
  } else throw new Error('Use command, vision-memory, or retrieve');
  writeFileSync(`artifacts/smoke/${phase}-result.json`, JSON.stringify({ passed: true, elapsedMs: result.elapsedMs, reply: result.result.reply }, null, 2));
  console.log(`${phase}: passed (${(result.elapsedMs / 1000).toFixed(1)}s)`);
} catch (error) {
  console.error(String(error.message).split('Call log:')[0]);
  process.exitCode = 1;
} finally { await api.dispose(); }
