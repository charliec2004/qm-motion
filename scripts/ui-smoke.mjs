import { chromium } from 'playwright';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { client, origin } from './qm-session.mjs';

// Exercise normal web input/rendering as well as the authenticated backend.
const api = await client();
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium' });
const marker = 'qmui-' + randomUUID();
let runPath;
try {
  mkdirSync('artifacts/smoke', { recursive: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true,
    storageState: '.state/portal-session.json', viewport: { width: 1280, height: 850 } });
  const page = await context.newPage();
  await page.goto(origin);
  await page.getByRole('button', { name: 'New session', exact: true }).click();
  await page.locator('button').filter({ hasText: 'GPT-6 Sol' }).filter({ hasText: 'Low' }).first().waitFor();
  const sent = page.waitForResponse(response =>
    response.url().endsWith('/api/turn') && response.request().method() === 'POST');
  await page.locator('textarea').first().fill(`Skip onboarding. Use execute to write ${marker} to /root/workspace/qm-ui-proof.txt, then read it back. Reply with that exact marker. Do not inspect credentials.`);
  await page.locator('textarea').first().press('Enter');
  const response = await sent;
  const body = response.request().postDataJSON();
  const launch = await response.json();
  if (!response.ok() || !launch.runId) throw new Error('UI submission failed.');
  console.log('UI submitted:', launch.runId, body.model, body.thinkingLevel);
  runPath = '/api/runs/' + launch.runId;
  const deadline = Date.now() + 240000;
  let result;
  while (Date.now() < deadline) {
    await page.waitForTimeout(1000);
    result = await (await api.get(runPath)).json();
    if (['done', 'failed'].includes(result.status)) break;
  }
  if (result?.result?.status !== 'ok' || !result.result.reply.includes(marker))
    throw new Error('UI agent did not finish the execution check.');
  await page.waitForFunction(value => document.body.innerText.split(value).length >= 3, marker);
  await page.screenshot({ path: 'artifacts/smoke/qm-ui-execution.png' });
  const name = execFileSync('python3', ['scripts/computer.py', '--name'], { encoding: 'utf8' }).trim();
  const parkDeadline = Date.now() + 30000;
  while (execFileSync('docker', ['inspect', '--format', '{{.State.Running}}', name], { encoding: 'utf8' }).trim() === 'true') {
    if (Date.now() > parkDeadline) throw new Error('Computer did not park; inspect concurrent turns/background jobs.');
    await page.waitForTimeout(250);
  }
  const actual = execFileSync('python3', ['scripts/computer.py', 'cat', '/root/workspace/qm-ui-proof.txt'], { encoding: 'utf8' }).trim();
  if (actual !== marker) throw new Error('Independent UI file read did not match.');
  writeFileSync('artifacts/smoke/ui-execution-result.json', JSON.stringify({ passed: true,
    model: body.model, effort: body.thinkingLevel, runId: launch.runId, result: result.result }, null, 2));
  console.log('UI send, rendered GPT-6 Sol reply, and independent computer read passed.');
} catch (error) {
  console.error(String(error.message).split('Call log:')[0]);
  if (runPath) {
    const run = await (await api.get(runPath)).json();
    writeFileSync('artifacts/smoke/ui-failure.json', JSON.stringify(run, null, 2));
    if (run.status === 'running') await api.post(runPath + '/signal', { data: { kind: 'abort' } });
  }
  process.exitCode = 1;
} finally {
  await browser.close();
  await api.dispose();
}
