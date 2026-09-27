import { chromium, request } from 'playwright';
import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
export const origin = new URL(JSON.parse(readFileSync(
  new URL('../deployment/qm.config.jsonc', import.meta.url), 'utf8')).publicUrl).origin;
export async function login() {
  mkdirSync('.state', { recursive: true, mode: 0o700 });
  const link = execFileSync('./node_modules/.bin/qm', ['admin-login'], { cwd: 'deployment', encoding: 'utf8' }).trim();
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true });
  try {
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();
    await page.goto(link);
    await page.locator('#admin-confirm').click();
    await page.waitForURL(url => !url.pathname.startsWith('/auth/'));
    await context.storageState({ path: '.state/portal-session.json' });
    chmodSync('.state/portal-session.json', 0o600);
  } finally { await browser.close(); }
}
export async function client() {
  try {
    if (!existsSync('.state/portal-session.json')) await login();
    let api = await request.newContext({ baseURL: origin, ignoreHTTPSErrors: true,
      storageState: '.state/portal-session.json', extraHTTPHeaders: { origin } });
    const probe = await api.get('/api/contexts');
    if (probe.status() !== 200 || !probe.headers()['content-type']?.includes('json')) {
      await api.dispose(); await login();
      api = await request.newContext({ baseURL: origin, ignoreHTTPSErrors: true,
        storageState: '.state/portal-session.json', extraHTTPHeaders: { origin } });
    }
    return api;
  } catch (error) {
    // Playwright call logs can contain session headers; keep them out of stdout.
    throw new Error(String(error.message).split('Call log:')[0]);
  }
}
export async function turn(api, text, options = {}, { timeoutMs = 240000 } = {}) {
  const started = Date.now();
  const response = await api.post('/api/turn', { data: { text, model: 'gpt-6-sol', harness: 'pi',
    timezone: 'America/Los_Angeles', ...options } });
  if (!response.ok()) throw new Error(`QM turn HTTP ${response.status()}: ${await response.text()}`);
  const launch = await response.json();
  if (!launch.runId) throw new Error('QM did not return a run ID');
  console.log('QM run started:', launch.runId);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    const run = await (await api.get(`/api/runs/${launch.runId}`)).json();
    if (['done', 'failed', 'waiting_approval'].includes(run.status)) {
      const result = { ...run, elapsedMs: Date.now() - started };
      mkdirSync('artifacts/smoke', { recursive: true });
      writeFileSync(`artifacts/smoke/run-${launch.runId}.json`, JSON.stringify(result, null, 2));
      return result;
    }
  }
  const last = await (await api.get(`/api/runs/${launch.runId}`)).json();
  mkdirSync('artifacts/smoke', { recursive: true });
  writeFileSync(`artifacts/smoke/run-${launch.runId}-timeout.json`, JSON.stringify(last, null, 2));
  const stop = await api.post(`/api/runs/${launch.runId}/signal`, { data: { kind: 'abort' } });
  throw new Error(`Run ${launch.runId} exceeded ${timeoutMs / 1000}s; saved its state and requested abort (HTTP ${stop.status()}). Inspect before retrying.`);
}
