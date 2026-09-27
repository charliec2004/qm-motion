// motion video: a person-facing MP4 built from takes' captured frames (real speed, then slow motion).
// It adds nothing to the evidence the model reads; inspect/compare stay the analysis path.
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { MOTION_DIR, UsageError, WORKSPACE, loadTake, num, round, takePath } from './common.mjs';
import { requireTrigger } from './inspect.mjs';
import { frameSize } from './sheets.mjs';

const requirePw = createRequire('/opt/qm-motion/package.json');
const FPS = 60;
const MAX_W = 1920;
const HOLD_S = 0.6;
const RIPPLE_MS = 300;
const even = n => Math.round(n / 2) * 2;
const MUST_MATCH = ['url', 'viewport', 'deviceScaleFactor', 'reducedMotion', 'trigger'];

// Runs in the page: show, for each panel, the latest frame captured at or before source time t,
// advancing at most one frame per video frame so every captured frame is on screen at least once.
function render({ t, badge }) {
  const V = window.__video;
  for (const p of V.panels) {
    let target = 0;
    while (target + 1 < p.ms.length && p.ms[target + 1] <= t) target++;
    const i = target < p.shown ? target : Math.min(target, p.shown + 1);
    if (p.shown !== i) { p.imgs[p.shown].style.visibility = 'hidden'; p.imgs[i].style.visibility = 'visible'; p.shown = i; }
    const age = t;
    if (p.ripple) {
      const on = age >= 0 && age <= V.rippleMs;
      p.ripple.style.opacity = on ? String(1 - age / V.rippleMs) : '0';
      const r = on ? 8 + (age / V.rippleMs) * 30 : 8;
      p.ripple.style.width = p.ripple.style.height = `${2 * r}px`;
      p.cursor.style.transform = age >= 0 && age <= 90 ? 'scale(0.85)' : 'none';
    }
    if (p.key) p.key.style.opacity = age >= 0 && age <= 600 ? '1' : '0';
  }
  document.getElementById('clock').textContent = `${t >= 0 ? '+' : '−'}${Math.abs(t).toFixed(0)} ms`;
  document.getElementById('badge').textContent = badge;
}

function page({ panels, panelW, panelH, triggerWord }) {
  const cursor = `<svg class="cursor" width="22" height="30" viewBox="0 0 22 30"><path d="M1 1 L1 24 L7 18 L11 28 L15 26 L11 17 L19 17 Z" fill="#fff" stroke="#000" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
  const html = panels.map((p, k) => `
    <section class="panel">
      <header><b>${p.title}</b><span>${p.subtitle}</span></header>
      <div class="stage" style="width:${panelW}px;height:${panelH}px">
        ${p.frames.map(f => `<img src="${f.url}" style="visibility:hidden">`).join('')}
        ${p.point ? `<div class="ripple" style="left:${p.point.x}px;top:${p.point.y}px"></div>
          <div class="cursor-wrap" style="left:${p.point.x}px;top:${p.point.y}px">${cursor}</div>` : ''}
        ${p.keyName ? `<div class="key">${p.keyName}</div>` : ''}
      </div>
    </section>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; margin: 0; }
    body { background: #111418; color: #f2f2f2; font: 15px "Liberation Sans", Arial, sans-serif; padding: 14px 16px; }
    .bar { display: flex; align-items: center; gap: 14px; height: 40px; }
    #badge { background: #f2c14e; color: #111; font-weight: 700; padding: 5px 10px; border-radius: 6px; }
    #clock { font: 700 22px "Liberation Mono", monospace; }
    .bar small { color: #9aa3ad; margin-left: auto; }
    .panels { display: flex; gap: 16px; margin-top: 10px; }
    .panel header { display: flex; gap: 10px; align-items: baseline; height: 30px; }
    .panel header b { font-size: 17px; letter-spacing: .06em; }
    .panel header span { color: #9aa3ad; font-size: 13px; }
    .stage { position: relative; overflow: hidden; background: #000; border-radius: 4px; }
    .stage img { position: absolute; inset: 0; width: 100%; height: 100%; }
    .cursor-wrap { position: absolute; transform-origin: 0 0; }
    .cursor { display: block; transform-origin: 1px 1px; filter: drop-shadow(0 1px 2px rgba(0,0,0,.5)); }
    .ripple { position: absolute; width: 16px; height: 16px; border: 3px solid #f2c14e; border-radius: 50%;
      transform: translate(-50%, -50%); opacity: 0; }
    .key { position: absolute; left: 12px; bottom: 12px; background: #f2c14e; color: #111; font-weight: 700;
      padding: 6px 10px; border-radius: 6px; opacity: 0; }
  </style></head><body>
    <div class="bar"><span id="badge"></span><span id="clock"></span><span>from the ${triggerWord}</span>
      <small>Built from captured frames · each frame held until the next · cursor drawn from the recorded ${triggerWord}</small></div>
    <div class="panels">${html}</div>
  </body></html>`;
}

async function encode(out, frames) {
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out]);
  let err = '';
  ff.stderr.on('data', d => { err += d; });
  const done = new Promise((resolve, reject) => ff.on('close', code => (code === 0 ? resolve() : reject(new Error(`ffmpeg failed: ${err.trim()}`)))));
  await frames(buf => new Promise(resolve => (ff.stdin.write(buf) ? resolve() : ff.stdin.once('drain', resolve))));
  ff.stdin.end();
  await done;
}

export async function video({ flags, positional }) {
  const pairs = flags.before !== undefined || flags.after !== undefined;
  if (pairs ? positional.length || !flags.before || !flags.after : positional.length !== 1)
    throw new UsageError('video needs one <take-id>, or --before <take-id> --after <take-id>');
  for (const v of [flags.before, flags.after]) if (v?.includes(',')) throw new UsageError('video takes one before and one after take ID; pick a representative take');
  const takes = pairs
    ? [{ ...loadTake(flags.before), title: 'BEFORE' }, { ...loadTake(flags.after), title: 'AFTER' }]
    : [{ ...loadTake(positional[0]), title: String(flags.title ?? 'TAKE').toUpperCase() }];
  takes.forEach(requireTrigger);
  const ref = takes[0].manifest.scenario;
  for (const t of takes.slice(1)) for (const f of MUST_MATCH)
    if (JSON.stringify(t.manifest.scenario[f]) !== JSON.stringify(ref[f]))
      throw new Error(`${f} differs between ${takes[0].takeId} and ${t.takeId}; a side-by-side video needs the same scenario`);
  const slow = num(flags, 'slow', 4);
  if (!(slow >= 1 && slow <= 16)) throw new UsageError('--slow must be between 1 and 16');

  const ms = takes.flatMap(t => t.frames.map(f => f.msFromTrigger));
  const start = Math.min(...ms, -ref.recordBeforeMs), end = Math.max(...ms, ref.recordAfterMs);
  const from = num(flags, 'from', start), to = num(flags, 'to', end);
  if (!(from < to)) throw new UsageError(`--from must be less than --to (got ${from} and ${to})`);

  const size = await frameSize(takePath(takes[0].takeId, takes[0].frames[0].file));
  const panelW = even(Math.min(size.width, (MAX_W - 32 - 16 * (takes.length - 1)) / takes.length));
  const panelH = even(size.height * panelW / size.width);
  const k = panelW / ref.viewport.width;
  const triggerWord = { click: 'click', hover: 'hover', press: 'key press' }[ref.trigger.action];
  const caveats = ['For people only: built from the takes\' captured frames, each held until the next arrives. Analyse with inspect/compare, not this video.',
    'Frame times are capture times, about 9–28 ms after the paint they show. Playback smoothness is not evidence of smoothness.'];
  const panels = takes.map(t => {
    const tr = t.manifest.trigger;
    const point = Number.isFinite(tr.x) && Number.isFinite(tr.y) && ref.trigger.action !== 'press' ? { x: round(tr.x * k, 1), y: round(tr.y * k, 1) } : null;
    if (!point && ref.trigger.action !== 'press') caveats.push(`${t.takeId} did not record the pointer position; no cursor drawn`);
    return { title: t.title, subtitle: `${t.takeId}${t.manifest.app?.revision ? ` · ${t.manifest.app.revision.slice(0, 7)}` : ''}`,
      frames: t.frames.map(f => ({ url: pathToFileURL(takePath(t.takeId, f.file)).href, ms: f.msFromTrigger })),
      point, keyName: ref.trigger.action === 'press' ? (tr.key ?? ref.trigger.key) : null };
  });

  // Timeline: real speed over the whole take, a short hold, then slow motion over the window, a hold.
  const step = 1000 / FPS;
  const timeline = [];
  const segment = (a, b, span, badge) => {
    for (let i = 0; a + i * span <= b; i++) timeline.push({ t: a + i * span, badge });
    for (let i = 0; i < HOLD_S * FPS; i++) timeline.push({ t: b, badge });
  };
  segment(start, end, step, 'Real speed');
  segment(from, to, step / slow, slow === 1 ? 'Replay' : `Slow motion 1/${slow}×`);

  const outId = `video-${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}-${randomBytes(2).toString('hex')}`;
  const outDir = join(WORKSPACE, MOTION_DIR, outId);
  mkdirSync(outDir, { recursive: true });
  const htmlPath = join(outDir, 'compose.html');
  writeFileSync(htmlPath, page({ panels, panelW, panelH, triggerWord }));
  const out = join(outDir, pairs ? 'before-after.mp4' : `${takes[0].takeId}.mp4`);

  const { chromium } = requirePw('playwright');
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--allow-file-access-from-files'] });
  try {
    const W = even(32 + takes.length * panelW + 16 * (takes.length - 1));
    const H = even(28 + 40 + 10 + 30 + panelH);
    const pg = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    await pg.goto(pathToFileURL(htmlPath).href);
    await pg.evaluate(async ({ panels, rippleMs }) => {
      const els = [...document.querySelectorAll('.panel')];
      await Promise.all([...document.images].map(img => img.decode()));
      window.__video = { rippleMs, panels: els.map((el, k) => ({ ms: panels[k].frames.map(f => f.ms), imgs: [...el.querySelectorAll('img')],
        shown: 0, ripple: el.querySelector('.ripple'), cursor: el.querySelector('.cursor-wrap'), key: el.querySelector('.key') })) };
      for (const p of window.__video.panels) p.imgs[0].style.visibility = 'visible';
    }, { panels, rippleMs: RIPPLE_MS });
    await encode(out, async write => {
      for (const state of timeline) {
        await pg.evaluate(render, state);
        await write(await pg.screenshot({ type: 'jpeg', quality: 92 }));
      }
    });
  } finally {
    await browser.close().catch(() => {});
  }
  // Chat shows .html attachments inline (sandboxed iframe) but offers MP4 only as a download.
  const player = join(outDir, 'player.html');
  writeFileSync(player, `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;height:100%;background:#111418}
video{display:block;width:100%;height:100%;object-fit:contain}</style></head><body>
<video autoplay muted loop playsinline controls src="data:video/mp4;base64,${readFileSync(out).toString('base64')}"></video></body></html>`);
  const result = { ok: true, video: `${MOTION_DIR}/${outId}/${out.split('/').pop()}`, player: `${MOTION_DIR}/${outId}/player.html`, durationS: round(timeline.length / FPS, 1),
    fps: FPS, realSpeedMs: [round(start, 1), round(end, 1)], slowMotion: { from, to, factor: slow },
    takes: takes.map(t => ({ title: t.title, takeId: t.takeId })), caveats,
    next: 'Attach player.html (plays inline in chat) and the MP4 (download) to your reply with the attach tool; keep citing table rows and sheet frames you viewed.' };
  writeFileSync(join(outDir, 'video.json'), JSON.stringify(result, null, 2));
  return result;
}
