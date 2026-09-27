// motion capture: fresh takes of one interaction, with every screencast frame and a per-frame trace.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CLI, MOTION_DIR, WORKSPACE, num, progress, round } from './common.mjs';
import { loadScenario } from './scenario.mjs';

const requirePw = createRequire('/opt/qm-motion/package.json');
const TRIGGER_EVENTS = { click: ['pointerdown', 'click'], hover: ['pointerover'], press: ['keydown'] };
const RESET = 'fresh take: new Chromium process, new context, fresh navigation';
const TIMING = 'CDP screencast metadata.timestamp; frames arrive ~9–28ms after the page state they show';
const wait = ms => new Promise(r => setTimeout(r, ms));

// Runs in the page: trigger listener plus a rAF sampler of the watched elements.
function installSampler({ watch, events }) {
  const M = (window.__motion = { samples: [], trigger: null, running: true });
  const onEvent = e => {
    if (!M.trigger) M.trigger = { event: e.type, timeStamp: e.timeStamp, wallMs: performance.timeOrigin + e.timeStamp };
  };
  for (const type of events) document.addEventListener(type, onEvent, true);
  const read = w => {
    const el = document.querySelector(w.selector);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const o = { x: r.x, y: r.y, width: r.width, height: r.height, opacity: Number(cs.opacity),
      display: cs.display, visibility: cs.visibility, hidden: el.hidden };
    if (w.attributes) o.attributes = Object.fromEntries(w.attributes.map(a => [a, el.getAttribute(a)]));
    if (w.styles) o.styles = Object.fromEntries(w.styles.map(s => [s, cs.getPropertyValue(s)]));
    return o;
  };
  const tick = ts => {
    if (!M.running) return;
    const elements = {};
    for (const w of watch) elements[w.name] = read(w);
    M.samples.push({ ts, elements });
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function locate(page, a) {
  if (a.selector) return page.locator(a.selector);
  if (a.role) return page.getByRole(a.role, { name: a.name, exact: !!a.exact });
  return null;
}

async function describeMiss(page, a) {
  if (a.selector) return `selector ${JSON.stringify(a.selector)} matched ${await page.locator(a.selector).count()} elements`;
  const names = await page.getByRole(a.role).evaluateAll(els =>
    els.slice(0, 10).map(e => (e.getAttribute('aria-label') || e.textContent || '').trim().replace(/\s+/g, ' ')));
  return `no ${a.role} named ${JSON.stringify(a.name)}; ${a.role} names on the page: ${JSON.stringify(names)}`;
}

async function perform(page, a, field) {
  const loc = locate(page, a);
  try {
    if (!loc) await page.keyboard.press(a.key);
    else if (a.action === 'click') await loc.first().click({ timeout: 5000 });
    else if (a.action === 'hover') await loc.first().hover({ timeout: 5000 });
    else await loc.first().press(a.key, { timeout: 5000 });
  } catch (e) {
    const miss = loc && (await loc.count()) === 0 ? await describeMiss(page, a) : String(e.message).split('\n')[0];
    throw new Error(`${field} ${a.action} failed: ${miss}. Fix the scenario's ${field}.`);
  }
}

function gitInfo(appDir) {
  if (!appDir) return { revision: null, diffSha256: null, status: null };
  try {
    const git = (...args) => execFileSync('git', ['-C', appDir, ...args], { encoding: 'utf8', maxBuffer: 64 << 20 });
    return { revision: git('rev-parse', 'HEAD').trim(),
      diffSha256: createHash('sha256').update(git('diff', 'HEAD')).digest('hex'),
      status: git('status', '--porcelain') };
  } catch { return { revision: null, diffSha256: null, status: null }; }
}

function takeId(label, n) {
  const utc = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
  return `${utc}-${label}-${n}-${randomBytes(2).toString('hex')}`;
}

async function oneTake(chromium, playwrightVersion, scenario, label, n) {
  const id = takeId(label, n);
  const dir = join(WORKSPACE, MOTION_DIR, id);
  const startedAt = new Date().toISOString();
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: scenario.viewport, deviceScaleFactor: scenario.deviceScaleFactor,
      reducedMotion: scenario.reducedMotion });
    const cdp = await page.context().newCDPSession(page);
    await page.goto(scenario.url, { waitUntil: 'load' });
    if (scenario.ready?.selector) {
      try { await page.locator(scenario.ready.selector).first().waitFor({ state: 'visible', timeout: 10000 }); }
      catch { throw new Error(`ready selector ${JSON.stringify(scenario.ready.selector)} was not visible within 10 s; check it against the page or edit "ready"`); }
    }
    await wait(scenario.ready?.settleMs ?? 350);
    for (const [i, a] of scenario.setup.entries()) { await perform(page, a, `setup[${i}]`); await wait(a.settleMs ?? 350); }

    await page.evaluate(installSampler, { watch: scenario.watch, events: TRIGGER_EVENTS[scenario.trigger.action] });
    const raw = [];
    cdp.on('Page.screencastFrame', async f => {
      raw.push({ data: f.data, ts: f.metadata.timestamp });
      try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch {}
    });
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 80, everyNthFrame: 1,
      maxWidth: Math.round(scenario.viewport.width * scenario.deviceScaleFactor),
      maxHeight: Math.round(scenario.viewport.height * scenario.deviceScaleFactor) });
    await wait(scenario.recordBeforeMs);
    await perform(page, scenario.trigger, 'trigger');
    await wait(scenario.recordAfterMs);
    await cdp.send('Page.stopScreencast');
    const M = await page.evaluate(() => { window.__motion.running = false; return window.__motion; });
    await wait(100);

    const trig = M.trigger;
    mkdirSync(join(dir, 'frames'), { recursive: true });
    raw.sort((a, b) => a.ts - b.ts);
    const frames = raw.map((f, i) => {
      const file = `frames/${String(i + 1).padStart(6, '0')}.jpg`;
      writeFileSync(join(dir, file), Buffer.from(f.data, 'base64'));
      return { file, chromeTimestampS: f.ts, msFromTrigger: trig ? round(f.ts * 1000 - trig.wallMs, 1) : null };
    });
    const trace = M.samples.map(s => ({ msFromTrigger: trig ? round(s.ts - trig.timeStamp, 1) : null, elements: s.elements }));
    const manifest = {
      takeId: id, label, n, scenario, reset: RESET,
      browser: browser.version(), playwrightVersion,
      app: gitInfo(scenario.appDir),
      trigger: { event: trig?.event ?? null, wallMs: trig?.wallMs ?? null },
      frameCount: frames.length, traceSampleCount: trace.length,
      sampler: 'rAF getBoundingClientRect + computed style', timingSource: TIMING, startedAt,
    };
    writeFileSync(join(dir, 'frames.json'), JSON.stringify(frames, null, 1));
    writeFileSync(join(dir, 'trace.json'), JSON.stringify(trace));
    writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
    return { takeId: id, dir: `${MOTION_DIR}/${id}`, frameCount: frames.length, traceSampleCount: trace.length,
      triggerFound: !!trig, triggerEvent: trig?.event ?? null,
      framesMs: trig && frames.length ? [frames[0].msFromTrigger, frames.at(-1).msFromTrigger] : null };
  } finally {
    await browser.close().catch(() => {});
  }
}

export async function capture({ flags }) {
  if (!flags.scenario) throw Object.assign(new Error('capture needs --scenario <file.json>'), { usage: true });
  const { scenario } = loadScenario(flags.scenario);
  scenario.recordBeforeMs = num(flags, 'before-ms', scenario.recordBeforeMs);
  scenario.recordAfterMs = num(flags, 'after-ms', scenario.recordAfterMs);
  if (!(scenario.recordBeforeMs >= 0 && scenario.recordAfterMs >= 0 && scenario.recordBeforeMs + scenario.recordAfterMs <= 10000))
    throw new Error('--before-ms and --after-ms must be >= 0 with a total of at most 10000');
  const takes = num(flags, 'takes', 3);
  if (!(Number.isInteger(takes) && takes >= 1)) throw new Error('--takes must be a whole number >= 1');
  const label = String(flags.label ?? 'take').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 16) || 'take';

  try { await fetch(scenario.url, { signal: AbortSignal.timeout(5000) }); }
  catch (e) {
    throw new Error(`url ${scenario.url} did not respond (${e.cause?.code ?? e.name}). Start the app server with the background tool, then retry.`);
  }
  const { chromium } = requirePw('playwright');
  const playwrightVersion = requirePw('playwright/package.json').version;
  const out = [];
  try {
    for (let n = 1; n <= takes; n++) {
      progress(`take ${n}/${takes}`);
      out.push(await oneTake(chromium, playwrightVersion, scenario, label, n));
    }
  } catch (e) {
    e.partial = { takes: out };
    throw e;
  }
  const result = { ok: true, takes: out, takeIds: out.map(t => t.takeId).join(','), next: `${CLI} inspect ${out[0].takeId}` };
  const missed = out.filter(t => !t.triggerFound);
  if (missed.length) {
    return { ...result, ok: false,
      error: `the trigger event never fired in take ${missed.map(t => t.takeId).join(', ')}; the element may be covered or disabled. Check the trigger target, then recapture.` };
  }
  return result;
}
