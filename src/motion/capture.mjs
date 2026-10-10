// motion capture: fresh takes of one interaction, with every screencast frame and a per-frame trace.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CLI, MOTION_DIR, WORKSPACE, num, progress, round } from './common.mjs';
import { loadScenario } from './scenario.mjs';
import { installSampler, perform } from './interactions.mjs';

const requirePw = createRequire('/opt/qm-motion/package.json');
const RESET = 'fresh take: new Chromium process, new context, fresh navigation; no cookies/storage imported';
const TIMING = 'CDP screencast metadata.timestamp; frames arrive ~9–28ms after the page state they show';
const wait = ms => new Promise(r => setTimeout(r, ms));

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

export async function oneTake(chromium, playwrightVersion, scenario, label, n, options = {}) {
  const id = takeId(label, n);
  const dir = join(options.workspace ?? WORKSPACE, MOTION_DIR, id);
  const startedAt = new Date().toISOString();
  const browser = await chromium.launch({ executablePath: options.executablePath ?? '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: scenario.viewport, deviceScaleFactor: scenario.deviceScaleFactor,
      reducedMotion: scenario.reducedMotion });
    const samples = [], events = new Map();
    let recording = false, navigationActionId = null;
    const navigations = [];
    page.on('framenavigated', frame => {
      if (!recording || frame !== page.mainFrame()) return;
      const event = { event: 'navigation', wallMs: Date.now(), url: frame.url(), timingSource: 'controller observation of Playwright framenavigated (commit)' };
      navigations.push(event);
      if (navigationActionId && !events.has(navigationActionId)) events.set(navigationActionId, event);
    });
    await page.exposeBinding('__motionEvidence', ({ frame }, evidence) => {
      if (!recording || frame !== page.mainFrame()) return;
      if (evidence.kind === 'sample') samples.push(evidence);
      else if (!events.has(evidence.id)) events.set(evidence.id, evidence);
    });
    await page.addInitScript(installSampler, { watch: scenario.watch });
    const cdp = await page.context().newCDPSession(page);
    await page.goto(scenario.url, { waitUntil: 'load' });
    if (scenario.ready?.selector) {
      try { await page.locator(scenario.ready.selector).first().waitFor({ state: 'visible', timeout: 10000 }); }
      catch { throw new Error(`ready selector ${JSON.stringify(scenario.ready.selector)} was not visible within 10 s; check it against the page or edit "ready"`); }
    }
    await wait(scenario.ready?.settleMs ?? 350);
    for (const [i, a] of scenario.setup.entries()) { await perform(page, a, `setup[${i}]`); await wait(a.settleMs ?? 350); }

    await page.evaluate(watch => { for (const w of watch) { try { document.querySelector(w.selector); } catch { throw new Error(`watch ${w.name} has invalid CSS selector ${w.selector}`); } } }, scenario.watch);
    const raw = [];
    cdp.on('Page.screencastFrame', async f => {
      raw.push({ data: f.data, ts: f.metadata.timestamp });
      try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch {}
    });
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 80, everyNthFrame: 1,
      maxWidth: Math.round(scenario.viewport.width * scenario.deviceScaleFactor),
      maxHeight: Math.round(scenario.viewport.height * scenario.deviceScaleFactor) });
    recording = true;
    const recordingStart = Date.now();
    const deadline = recordingStart + scenario.recordBeforeMs + scenario.actions.at(-1).atMs + scenario.recordAfterMs;
    await wait(scenario.recordBeforeMs);
    const actions = [];
    let origin = null, failure = null;
    for (const action of scenario.actions) {
      if (origin !== null) await wait(Math.max(0, origin + action.atMs - Date.now()));
      const entry = { id: action.id, action: action.action, target: action.selector ? { selector: action.selector } : action.role ? { role: action.role, name: action.name, exact: !!action.exact } : action.url ? { url: action.url } : { page: true }, requestedAtMs: action.atMs, dispatchWallMs: null, completedWallMs: null, event: null, status: 'pending' };
      actions.push(entry);
      try {
        const remaining = deadline - Date.now();
        if (remaining <= 0) throw new Error('recording deadline reached before action dispatch');
        let timer;
        const operation = perform(page, action, `action ${action.id}`, { recorded: true, deadline, timeout: Math.min(5000, remaining), onDispatch: () => {
          navigationActionId = action.action === 'navigate' ? action.id : null;
          entry.dispatchWallMs = Date.now();
          if (origin === null) origin = entry.dispatchWallMs;
        } });
        try { await Promise.race([operation, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`action ${action.id}: recording deadline reached; partial evidence retained`)), remaining); })]); }
        finally { clearTimeout(timer); }
        entry.completedWallMs = Date.now();
        // DOM event times are supplied by the page, not requested offsets.
        // Navigation uses a controller-observed commit event, with its timing source stated.
        entry.status = 'completed';
      } catch (e) {
        entry.status = 'failed'; entry.error = e.message; failure = e.message; break;
      }
    }
    await wait(Math.max(0, Math.min(scenario.recordAfterMs, deadline - Date.now())));
    await cdp.send('Page.stopScreencast').catch(e => { failure ??= `screencast stop failed: ${e.message}`; });
    const recordingEnd = Date.now();
    await wait(100); // Drain events already emitted before stop.
    recording = false;
    for (const entry of actions) {
      entry.event = events.get(entry.id) ?? null;
      entry.actualAtMs = entry.event && origin !== null ? round(entry.event.wallMs - origin, 1) : null;
      if (entry.status === 'completed' && !entry.event) {
        entry.status = 'event-missing'; failure ??= `action ${entry.id} completed but no matching DOM event was observed; check disabled controls or hover state`;
      }
    }
    for (const action of scenario.actions.slice(actions.length)) actions.push({ id: action.id, action: action.action,
      target: action.selector ? { selector: action.selector } : action.role ? { role: action.role, name: action.name } : action.url ? { url: action.url } : { page: true },
      requestedAtMs: action.atMs, dispatchWallMs: null, completedWallMs: null, actualAtMs: null, event: null, status: 'skipped', error: 'not attempted after an earlier action failed' });
    if (!raw.length) failure ??= 'Chromium delivered no screencast frames; recapture and check browser/CDP support';
    const trig = events.get(scenario.alignAction) ?? null;
    mkdirSync(join(dir, 'frames'), { recursive: true });
    raw.sort((a, b) => a.ts - b.ts);
    const frames = raw.map((f, i) => {
      const file = `frames/${String(i + 1).padStart(6, '0')}.jpg`;
      writeFileSync(join(dir, file), Buffer.from(f.data, 'base64'));
      return { file, wallMs: f.ts * 1000, chromeTimestampS: f.ts, msFromTrigger: trig ? round(f.ts * 1000 - trig.wallMs, 1) : null };
    });
    const trace = samples.filter(s => s.wallMs <= recordingEnd).sort((a, b) => a.wallMs - b.wallMs).map(s => ({ wallMs: s.wallMs, msFromTrigger: trig ? round(s.wallMs - trig.wallMs, 1) : null, elements: s.elements }));
    if (!frames.length) failure ??= 'no screencast frames were received; recapture before claiming this interaction was checked';
    const manifest = {
      takeId: id, label, n, scenario, reset: RESET,
      browser: browser.version(), playwrightVersion,
      app: gitInfo(scenario.appDir),
      trigger: { event: trig?.event ?? null, wallMs: trig?.wallMs ?? null, x: trig?.x ?? null, y: trig?.y ?? null, key: trig?.key ?? null },
      actions, navigations, alignment: { actionId: scenario.alignAction, wallMs: trig?.wallMs ?? null },
      recording: { startedWallMs: recordingStart, endedWallMs: recordingEnd, timingSource: 'controller clock at recording start and screencast stop acknowledgement' },
      status: failure ? 'partial' : 'complete', error: failure,
      frameCount: frames.length, traceSampleCount: trace.length,
      sampler: 'rAF getBoundingClientRect + computed style', timingSource: TIMING, startedAt,
    };
    writeFileSync(join(dir, 'frames.json'), JSON.stringify(frames, null, 1));
    writeFileSync(join(dir, 'trace.json'), JSON.stringify(trace));
    writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
    return { takeId: id, dir: `${MOTION_DIR}/${id}`, frameCount: frames.length, traceSampleCount: trace.length,
      status: failure ? 'partial' : 'complete', error: failure, actions, alignment: scenario.alignAction,
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
  if (!(scenario.recordBeforeMs >= 0 && scenario.recordAfterMs >= 0 && scenario.recordBeforeMs + scenario.actions.at(-1).atMs + scenario.recordAfterMs <= 10000))
    throw new Error('--before-ms and --after-ms must be >= 0 with before + last action offset + after at most 10000 ms');
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
  const missed = out.filter(t => !t.triggerFound || t.status === 'partial');
  if (missed.length) {
    return { ...result, ok: false,
      error: missed.map(t => `${t.takeId}: ${t.error ?? 'selected alignment event never fired; choose an observed action or recapture'}`).join('; ') };
  }
  return result;
}
