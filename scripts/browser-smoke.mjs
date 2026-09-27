import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomInt } from 'node:crypto';
const exec = promisify(execFile);
const root = '/root/workspace/artifacts/environment-smoke';
await mkdir(root, { recursive: true });
const visualCode = String(randomInt(100000, 999999));
const page = `<!doctype html><title>QM Motion environment check</title><style>
body{font:28px sans-serif;background:#f8fafc;padding:40px;color:#132536}
.shape{width:100px;height:100px;display:inline-block;margin:30px}
.round{background:#3b82f6;border-radius:50%;animation:move 1s ease-in-out infinite alternate}
.square{background:#e23d3d}.triangle{background:#16a34a;clip-path:polygon(50% 0,100% 100%,0 100%)}
@keyframes move{to{transform:translateY(20px)}}
</style><h1>QM Motion environment check</h1><p>Visual code: <b>${visualCode}</b></p>
<div class="shape round"></div><div class="shape square"></div><div class="shape triangle"></div>`;
const server = createServer((_request, response) => { response.setHeader('content-type', 'text/html'); response.end(page); });
await new Promise(resolve => server.listen(4174, '127.0.0.1', resolve));
const session = 'qm-environment-smoke';
const base = ['--session', session, '--executable-path', '/usr/bin/chromium', '--args', '--no-sandbox'];
async function browser(...args) {
  const result = await exec('agent-browser', [...base, ...args], { timeout: 60000, maxBuffer: 2e6 });
  return result.stdout.trim();
}
try {
  await browser('open', 'http://127.0.0.1:4174');
  await browser('set', 'viewport', '960', '720');
  await browser('screenshot', root + '/visual.png');
  const startedAt = Date.now();
  await browser('record', 'start', root + '/neutral.webm', '--contact-sheet');
  await new Promise(resolve => setTimeout(resolve, 3000));
  const recording = await browser('record', 'stop');
  const ffprobe = JSON.parse((await exec('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', root + '/neutral.webm'])).stdout);
  const metadata = { purpose: 'neutral environment check, not product demo', visualCode, viewport: { width: 960, height: 720 },
    browser: (await exec('chromium', ['--version'])).stdout.trim(),
    recorder: (await exec('agent-browser', ['--version'])).stdout.trim(), startedAt,
    finishedAt: Date.now(), recording, ffprobe };
  await writeFile(root + '/metadata.json', JSON.stringify(metadata, null, 2));
  if (Number(ffprobe.format.duration) < 2) throw new Error('Recording shorter than expected');
  console.log(JSON.stringify({ root, browser: metadata.browser, duration: ffprobe.format.duration, recording }));
} finally {
  await browser('close').catch(() => {});
  server.close();
}
