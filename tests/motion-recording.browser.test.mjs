// Real Chromium boundary tests. Run with MOTION_TEST_PLAYWRIGHT_PACKAGE pointing
// to an installed package.json when using a dependency-free worktree.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { oneTake } from '../src/motion/capture.mjs';
import { loadScenario, alignTake } from '../src/motion/scenario.mjs';
import { recorderSource } from '../scripts/preview-recording.mjs';
import { installSampler, perform } from '../src/motion/interactions.mjs';
const require = createRequire(process.env.MOTION_TEST_PLAYWRIGHT_PACKAGE ?? new URL('../package.json', import.meta.url));
let chromium;
try { ({ chromium } = require('playwright')); } catch {}

const pageHtml = `<html><head></head><body><button id="toggle">Toggle</button><div id="panel" style="height:100px;transition:height 1200ms;background:red"></div><a id="next" href="/next">Next</a><input id="secret" type="password"><script>toggle.onclick=()=>{panel.style.height=panel.style.height==='100px'?'0px':'100px';};</script></body></html>`;
async function fixture(fn) {
  const workspace = mkdtempSync(join(tmpdir(), 'motion-browser-'));
  const server = createServer((req, res) => {
    res.setHeader('content-type', 'text/html');
    if (req.url === '/hash') return res.end('<html><body>Destination<script>setTimeout(()=>location.hash="later",80)</script></body></html>');
    res.end((req.url === '/next' ? '<html><head></head><body><button id="done">Done</button><div id="panel">Next document</div></body></html>' : pageHtml).replace('</head>', `<script>${recorderSource()}</script></head>`));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/`;
  const scenario = raw => {
    const file = join(workspace, 'scenario.json');
    writeFileSync(file, JSON.stringify({ name: 'sequence-check', url, ready: { settleMs: 50 }, recordBeforeMs: 50, recordAfterMs: 1500, watch: [{ name: 'panel', selector: '#panel' }], ...raw }));
    return loadScenario(file).scenario;
  };
  const readTake = result => ({ takeId: result.takeId, ...Object.fromEntries(['manifest','frames','trace'].map(k => [k, JSON.parse(readFileSync(join(workspace, result.dir, k + '.json'), 'utf8'))])) });
  try { await fn({ workspace, url, scenario, readTake }); }
  finally { await new Promise(r => server.close(r)); rmSync(workspace, { recursive: true, force: true }); }
}

test('navigation alignment retains the first commit when the destination later changes its hash', { skip: !chromium }, async () => fixture(async ({ workspace, url, scenario, readTake }) => {
  const result = await oneTake(chromium, 'test', scenario({ actions: [{ id: 'navigate', atMs: 0, action: 'navigate', url: url + 'hash' }] }), 'nav-anchor', 1, { workspace });
  assert.equal(result.status, 'complete', result.error);
  const take = readTake(result);
  assert.equal(take.manifest.actions[0].event.url, url + 'hash');
  assert.equal(take.manifest.trigger.wallMs, take.manifest.actions[0].event.wallMs);
  assert.ok(take.manifest.navigations.some(n => n.url === url + 'hash#later'));
  assert.ok(take.manifest.navigations.find(n => n.url === url + 'hash#later').wallMs > take.manifest.trigger.wallMs);
}));

test('real rapid close/reopen dispatches during animation, repeated fresh takes, navigation and partial failure', { skip: !chromium }, async () => fixture(async ({ workspace, url, scenario, readTake }) => {
  const actions = [{ id: 'close', action: 'click', selector: '#toggle', atMs: 0 }, { id: 'reopen', action: 'click', selector: '#toggle', atMs: 80 }, { id: 'navigate', action: 'navigate', url: url + 'next', atMs: 160 }, { id: 'done', action: 'click', selector: '#done', atMs: 240 }];
  for (let n = 1; n <= 2; n++) {
    const result = await oneTake(chromium, 'test', scenario({ actions, alignAction: 'reopen' }), 'sequence', n, { workspace });
    assert.equal(result.status, 'complete', result.error + JSON.stringify(result.actions));
    const take = readTake(result);
    assert.ok(take.manifest.actions.every(a => a.event && a.dispatchWallMs));
    const close = take.manifest.actions[0], reopen = take.manifest.actions[1];
    const actualGap = reopen.event.wallMs - close.event.wallMs;
    assert.equal(reopen.requestedAtMs, 80);
    assert.ok(Math.abs((reopen.actualAtMs - close.actualAtMs) - actualGap) < 0.2, 'actual timing must come from observed events, with manifest rounding');
    assert.ok(actualGap > 0 && actualGap < 1200, 'reopen must interrupt the real 1200 ms transition: ' + JSON.stringify(take.manifest.actions));
    assert.ok(take.trace.some(s => s.wallMs > close.event.wallMs && s.wallMs < reopen.event.wallMs && s.elements.panel?.height > 0 && s.elements.panel.height < 100), 'observe the in-progress transition before interruption');
    assert.ok(take.trace.some(s => s.elements.panel?.height === 100 && s.msFromTrigger < 0), 'take starts with original panel state');
    assert.ok(take.trace.some(s => s.elements.panel?.height < 100));
    assert.ok(take.manifest.navigations.length);
    assert.ok(take.trace.some(s => s.wallMs > take.manifest.actions[2].event.wallMs), 'samples survive navigation');
    assert.ok(take.frames.length > 1);
    assert.equal(alignTake(take, 'close').manifest.alignment.actionId, 'close');
  }
  const partial = await oneTake(chromium, 'test', scenario({ actions: [{ ...actions[0] }, { id: 'missing', action: 'click', selector: '#absent', atMs: 80 }] }), 'partial', 1, { workspace });
  assert.equal(partial.status, 'partial');
  assert.ok(partial.error.includes('missing'));
  const take = readTake(partial); assert.ok(take.frames.length); assert.ok(take.trace.length); assert.equal(take.manifest.actions[1].status, 'failed');
  const legacy = await oneTake(chromium, 'test', scenario({ trigger: { action: 'click', selector: '#toggle' } }), 'legacy', 1, { workspace });
  assert.equal(legacy.status, 'complete', legacy.error);
}));

test('recorder rejects reloads after clicks and unexplained document changes', { skip: !chromium }, async () => fixture(async ({ url }) => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    const controls = id => page.locator('#__motion-recorder').locator('#' + id);
    await page.goto(url);
    await Promise.all([page.waitForEvent('load'), controls('start').click()]);
    await page.locator('#toggle').click();
    await page.reload();
    await page.locator('#toggle').click();
    await controls('stop').click();
    assert.equal(await controls('export').isDisabled(), true);
    let state = await page.evaluate(() => JSON.parse(sessionStorage.getItem('__qm_motion_demonstration_v1')));
    assert.equal(state.actions.length, 2);
    assert.match(state.unsupported.join(' '), /reloaded or changed/);
    await controls('discard').click();
    await Promise.all([page.waitForEvent('load'), controls('start').click()]);
    await page.locator('#toggle').click();
    await page.goto(url + 'next');
    await controls('stop').click();
    assert.equal(await controls('export').isDisabled(), true);
    state = await page.evaluate(() => JSON.parse(sessionStorage.getItem('__qm_motion_demonstration_v1')));
    assert.match(state.unsupported.join(' '), /matching recorded link activation/);
  } finally { await browser.close(); }
}));

test('recorder exports and replays Shift+Tab and Enter link navigation', { skip: !chromium }, async () => fixture(async ({ workspace, url, scenario }) => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 960, height: 720 } });
    const controls = id => page.locator('#__motion-recorder').locator('#' + id);
    await page.goto(url);
    await Promise.all([page.waitForEvent('load'), controls('start').click()]);
    for (const key of ['Tab', 'Tab', 'Shift+Tab', 'Tab']) await page.keyboard.press(key);
    assert.equal(await page.locator('#next').evaluate(el => el === document.activeElement), true);
    await Promise.all([page.waitForURL(url + 'next'), page.keyboard.press('Enter')]);
    await page.locator('#done').click();
    await controls('stop').click();
    assert.equal(await controls('export').isDisabled(), false);
    await controls('description').fill('Keyboard navigation jumps');
    const downloaded = page.waitForEvent('download'); await controls('export').click();
    const path = join(workspace, 'keyboard-export.json'); await (await downloaded).saveAs(path);
    const exported = JSON.parse(readFileSync(path, 'utf8')); exported.url = url;
    assert.deepEqual(exported.actions.slice(0, -1).map(a => a.key), ['Tab', 'Tab', 'Shift+Tab', 'Tab', 'Enter']);
    const result = await oneTake(chromium, 'test', scenario(exported), 'keyboard-demonstration', 1, { workspace });
    assert.equal(result.status, 'complete', result.error);
  } finally { await browser.close(); }
}));

test('keyboard link activation blocks external destinations, downloads and new tabs', { skip: !chromium }, async () => fixture(async ({ url }) => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  try {
    for (const attributes of [{ href: 'https://example.invalid/' }, { target: '_blank' }, { download: 'file' }, { baseTarget: '_blank' }]) {
      const page = await browser.newPage();
      const controls = id => page.locator('#__motion-recorder').locator('#' + id);
      await page.goto(url);
      await Promise.all([page.waitForEvent('load'), controls('start').click()]);
      await page.locator('#next').evaluate((el, attributes) => {
        for (const [key, value] of Object.entries(attributes)) {
          if (key === 'baseTarget') { const base = document.createElement('base'); base.target = value; document.head.append(base); }
          else el.setAttribute(key, value);
        }
        // Exercise the activation checks without opening another window or leaving the fixture.
        el.addEventListener('click', e => e.preventDefault());
      }, attributes);
      await page.locator('#next').focus(); await page.keyboard.press('Enter');
      await controls('stop').click();
      assert.equal(await controls('export').isDisabled(), true);
      assert.match(await controls('status').textContent(), /External navigation, downloads and new tabs/);
      await page.close();
    }
  } finally { await browser.close(); }
}));

test('sampler timestamps the intended key instead of modifier or unrelated keydown', { skip: !chromium }, async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    const events = [];
    await page.exposeFunction('__motionEvidence', event => { if (event.kind === 'event') events.push(event); });
    await page.setContent('<button id="first">First</button><button id="second">Second</button>');
    await page.evaluate(installSampler, { watch: [] });
    await page.evaluate(() => {
      window.keydowns = [];
      document.addEventListener('keydown', e => window.keydowns.push({ key: e.key, wallMs: performance.timeOrigin + e.timeStamp }));
      window.__motion.armed = { id: 'back', type: 'keydown', key: 'Shift+Tab' };
    });
    await page.keyboard.press('ArrowDown');
    await page.locator('#second').focus();
    await page.keyboard.press('Shift+Tab');
    await page.waitForFunction(() => document.activeElement.id === 'first');
    const keydowns = await page.evaluate(() => window.keydowns);
    assert.equal(events.length, 1);
    assert.equal(events[0].key, 'Shift+Tab');
    assert.equal(events[0].wallMs, keydowns.find(e => e.key === 'Tab').wallMs);
    assert.ok(events[0].wallMs > keydowns.find(e => e.key === 'Shift').wallMs);
    await perform(page, { id: 'space', action: 'press', key: 'Space' }, 'space', { recorded: true });
    assert.equal(events.at(-1).key, 'Space');
  } finally { await browser.close(); }
});

test('explicit user recorder exports and replays clicks without authored selectors; sensitive input blocks export', { skip: !chromium }, async () => fixture(async ({ workspace, url, scenario, readTake }) => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 960, height: 720 } });
    await page.goto(url);
    const controls = id => page.locator('#__motion-recorder').locator('#' + id);
    await Promise.all([page.waitForEvent('load'), controls('start').click()]);
    await page.locator('#toggle').click(); await page.waitForTimeout(90); await page.locator('#toggle').click();
    await controls('stop').click(); await controls('description').fill('The panel jumps on close');
    const downloadPromise = page.waitForEvent('download'); await controls('export').click();
    const download = await downloadPromise;
    const path = join(workspace, 'export.json'); await download.saveAs(path);
    const exported = JSON.parse(readFileSync(path, 'utf8'));
    assert.equal(exported.actions.length, 2);
    assert.ok(exported.actions.every(a => a.selector === '#toggle'));
    assert.equal(exported.demonstration.description, 'The panel jumps on close');
    exported.url = url; // Test fixture uses a random port; production export targets agent localhost:5173.
    const replay = await oneTake(chromium, 'test', scenario(exported), 'demonstration', 1, { workspace });
    assert.equal(replay.status, 'complete', replay.error);
    await controls('discard').click(); await Promise.all([page.waitForEvent('load'), controls('start').click()]);
    await Promise.all([page.waitForURL(url + 'next'), page.locator('#next').click()]);
    await page.locator('#done').click(); await controls('stop').click(); await controls('description').fill('Navigation jumps');
    const navDownload = page.waitForEvent('download'); await controls('export').click();
    const navPath = join(workspace, 'navigation-export.json'); await (await navDownload).saveAs(navPath);
    const navScenario = JSON.parse(readFileSync(navPath, 'utf8')); navScenario.url = url;
    assert.deepEqual(navScenario.actions.map(a => a.selector), ['#next', '#done']);
    const navReplay = await oneTake(chromium, 'test', scenario(navScenario), 'nav-demonstration', 1, { workspace });
    assert.equal(navReplay.status, 'complete', navReplay.error);
    await controls('discard').click(); await page.goto(url); await Promise.all([page.waitForEvent('load'), controls('start').click()]);
    await page.locator('#secret').fill('never-save-this-value');
    await controls('stop').click();
    assert.equal(await controls('export').isDisabled(), true);
    const stored = await page.evaluate(() => sessionStorage.getItem('__qm_motion_demonstration_v1'));
    assert.ok(!stored.includes('never-save-this-value'));
    assert.ok(JSON.parse(stored).unsupported.length);
  } finally { await browser.close(); }
}));
