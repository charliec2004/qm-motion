import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { client, origin } from './qm-session.mjs';

// Type one request into the real QM web UI and keep a labelled video of the whole turn.
// usage: node scripts/record-investigation.mjs [--timeout <seconds>] "<request>"
const args = process.argv.slice(2);
const timeoutSec = args[0] === '--timeout' ? Number(args.splice(0, 2)[1]) : 1200;
const request = args.join(' ');
if (!request || !(timeoutSec > 0)) {
  console.error('usage: node scripts/record-investigation.mjs [--timeout <seconds>] "<request>"');
  process.exit(2);
}
const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
const out = `artifacts/demo-recording/${stamp}`;
mkdirSync(out, { recursive: true });
const api = await client();
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium' });
const size = { width: 1280, height: 850 };
const context = await browser.newContext({ ignoreHTTPSErrors: true, storageState: '.state/portal-session.json',
  viewport: size, recordVideo: { dir: out, size } });
const page = await context.newPage();
let runId, result;
try {
  await page.goto(origin);
  await page.getByRole('button', { name: 'New session', exact: true }).click();
  await page.locator('button').filter({ hasText: 'GPT-6 Sol' }).filter({ hasText: 'Low' }).first().waitFor();
  const sent = page.waitForResponse(r => r.url().endsWith('/api/turn') && r.request().method() === 'POST');
  await page.locator('textarea').first().pressSequentially(request, { delay: 12 });
  await page.locator('textarea').first().press('Enter');
  runId = (await (await sent).json()).runId;
  if (!runId) throw new Error('UI submission returned no run ID');
  console.log('UI run started:', runId);
  const deadline = Date.now() + timeoutSec * 1000;
  while (Date.now() < deadline) {
    await page.waitForTimeout(2000);
    result = await (await api.get(`/api/runs/${runId}`)).json();
    if (['done', 'failed', 'waiting_approval'].includes(result.status)) break;
  }
  if (!['done', 'failed', 'waiting_approval'].includes(result?.status)) throw new Error(`run ${runId} exceeded ${timeoutSec}s`);
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${out}/final.png` });
} finally {
  writeFileSync(`${out}/run.json`, JSON.stringify({ runId, request, ...result }, null, 2));
  const video = page.video();
  await context.close();
  if (video) renameSync(await video.path(), `${out}/raw.webm`);
  await browser.close();
  await api.dispose();
}
const label = `Recorded real QM turn ${stamp}Z  run ${runId.slice(0, 8)}  real time  not live`;
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', `${out}/raw.webm`, '-vf',
  `drawtext=fontfile=/usr/share/fonts/noto/NotoSans-Regular.ttf:text='${label}':fontsize=18:fontcolor=white:box=1:boxcolor=black@0.75:boxborderw=6:x=10:y=h-th-12`,
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', `${out}/investigation-labelled.mp4`]);
console.log(JSON.stringify({ status: result.status, reply: result.result?.reply, attachments: result.result?.attachments?.map(a => a.name),
  video: `${out}/investigation-labelled.mp4` }, null, 2));
