// Person-facing before/after video, built by compare from two takes' captured frames.
// It adds nothing to the evidence the model reads; the model never sees it.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { round, takePath } from './common.mjs';
import { cropBox, frameSize } from './sheets.mjs';

const requirePw = createRequire('/opt/qm-motion/package.json');
const FPS = 60;
const SLOW = 4;
const MAX_W = 1920;
const MAX_PANEL_H = 900;
const HOLD_S = 0.6;
const RIPPLE_MS = 300;
const even = n => Math.max(2, Math.round(n / 2) * 2);

// Runs in the page: show, for each panel, the latest frame captured at or before source time t,
// advancing at most one frame per video frame so every captured frame is on screen at least once.
function render({ t, badge }) {
  const V = window.__video;
  for (const p of V.panels) {
    let target = 0;
    while (target + 1 < p.ms.length && p.ms[target + 1] <= t) target++;
    const i = target < p.shown ? target : Math.min(target, p.shown + 1);
    if (p.shown !== i) { p.imgs[p.shown].style.visibility = 'hidden'; p.imgs[i].style.visibility = 'visible'; p.shown = i; }
    if (p.ripple) {
      const on = t >= 0 && t <= V.rippleMs;
      p.ripple.style.opacity = on ? String(1 - t / V.rippleMs) : '0';
      const r = on ? 8 + (t / V.rippleMs) * 30 : 8;
      p.ripple.style.width = p.ripple.style.height = `${2 * r}px`;
      p.cursor.style.transform = t >= 0 && t <= 90 ? 'scale(0.85)' : 'none';
    }
    if (p.key) p.key.style.opacity = t >= 0 && t <= 600 ? '1' : '0';
  }
  document.getElementById('clock').textContent = `${t >= 0 ? '+' : '−'}${Math.abs(t).toFixed(0)} ms`;
  document.getElementById('badge').textContent = badge;
}

function page({ panels, panelW, panelH, img, triggerWord }) {
  const cursor = '<svg width="22" height="30" viewBox="0 0 22 30"><path d="M1 1 L1 24 L7 18 L11 28 L15 26 L11 17 L19 17 Z" fill="#fff" stroke="#000" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  const html = panels.map(p => `
    <section class="panel">
      <header><b>${p.title}</b><span>${p.subtitle}</span></header>
      <div class="stage" style="width:${panelW}px;height:${panelH}px">
        ${p.frames.map(f => `<img src="${f.url}" style="visibility:hidden;left:${img.left}px;top:${img.top}px;width:${img.width}px;height:${img.height}px">`).join('')}
        ${p.point ? `<div class="ripple" style="left:${p.point.x}px;top:${p.point.y}px"></div>
          <div class="cursor" style="left:${p.point.x}px;top:${p.point.y}px">${cursor}</div>` : ''}
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
    .stage img { position: absolute; }
    .cursor { position: absolute; transform-origin: 1px 1px; filter: drop-shadow(0 1px 2px rgba(0,0,0,.5)); }
    .cursor svg { display: block; }
    .ripple { position: absolute; width: 16px; height: 16px; border: 3px solid #f2c14e; border-radius: 50%;
      transform: translate(-50%, -50%); opacity: 0; }
    .key { position: absolute; left: 12px; bottom: 12px; background: #f2c14e; color: #111; font-weight: 700;
      padding: 6px 10px; border-radius: 6px; opacity: 0; }
  </style></head><body>
    <div class="bar"><span id="badge"></span><span id="clock"></span><span>from the ${triggerWord}</span>
      <small>Built from captured frames · each frame held until the next · cursor drawn at the recorded ${triggerWord}</small></div>
    <div class="panels">${html}</div>
  </body></html>`;
}

// One FFmpeg process reads the JPEG stream once and writes H.264 MP4 and VP9 WebM.
async function encode(mp4, webm, produce) {
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-map', '0', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4,
    '-map', '0', '-c:v', 'libvpx-vp9', '-deadline', 'realtime', '-cpu-used', '8', '-row-mt', '1', '-b:v', '0', '-crf', '30',
    '-pix_fmt', 'yuv420p', webm]);
  let err = '';
  ff.stderr.on('data', d => { err += d; });
  const done = new Promise((resolve, reject) => ff.on('close', code => (code === 0 ? resolve() : reject(new Error(`ffmpeg failed: ${err.trim()}`)))));
  await produce(buf => new Promise(resolve => (ff.stdin.write(buf) ? resolve() : ff.stdin.once('drain', resolve))));
  ff.stdin.end();
  await done;
}

// before/after: loaded takes with a matching scenario (compare checks this). from/to: the slow-motion window.
export async function renderVideo({ before, after, from, to, crop, outDir }) {
  const takes = [{ ...before, title: 'BEFORE' }, { ...after, title: 'AFTER' }];
  const sc = before.manifest.scenario;
  const size = await frameSize(takePath(before.takeId, before.frames[0].file));
  const { box } = cropBox(crop, sc.viewport, size);
  let panelW = even(Math.min(box.w * 2, (MAX_W - 32 - 16) / 2));
  let panelH = even(box.h * panelW / box.w);
  if (panelH > MAX_PANEL_H) { panelH = MAX_PANEL_H; panelW = even(box.w * panelH / box.h); }
  const s = panelW / box.w;
  const img = { left: round(-box.x * s, 2), top: round(-box.y * s, 2), width: round(size.width * s, 2), height: round(size.height * s, 2) };
  const k = size.width / sc.viewport.width;
  const action = sc.trigger.action;
  const triggerWord = { click: 'click', hover: 'hover', press: 'key press' }[action];
  const notes = [];
  const panels = takes.map(t => {
    const tr = t.manifest.trigger;
    let point = null;
    if (action !== 'press') {
      if (Number.isFinite(tr.x) && Number.isFinite(tr.y)) {
        const x = (tr.x * k - box.x) * s, y = (tr.y * k - box.y) * s;
        if (x >= 0 && y >= 0 && x <= panelW && y <= panelH) point = { x: round(x, 1), y: round(y, 1) };
      } else notes.push(`${t.takeId} has no recorded pointer position; no cursor drawn`);
    }
    return { title: t.title, subtitle: `${t.takeId}${t.manifest.app?.revision ? ` · ${t.manifest.app.revision.slice(0, 7)}` : ''}`,
      frames: t.frames.map(f => ({ url: pathToFileURL(takePath(t.takeId, f.file)).href, ms: f.msFromTrigger })),
      point, keyName: action === 'press' ? (tr.key ?? sc.trigger.key) : null };
  });

  // Real speed over the whole record window, a hold, then slow motion over the compare window, a hold.
  const ms = takes.flatMap(t => t.frames.map(f => f.msFromTrigger));
  const start = Math.min(...ms, -sc.recordBeforeMs), end = Math.max(...ms, sc.recordAfterMs);
  const lo = Math.max(from, start), hi = Math.min(to, end);
  const step = 1000 / FPS;
  const timeline = [];
  const segment = (a, b, span, badge) => {
    for (let i = 0; a + i * span <= b; i++) timeline.push({ t: a + i * span, badge });
    for (let i = 0; i < HOLD_S * FPS; i++) timeline.push({ t: b, badge });
  };
  segment(start, end, step, 'Real speed');
  if (lo < hi) segment(lo, hi, step / SLOW, `Slow motion 1/${SLOW}×`);

  const htmlPath = join(outDir, 'video-compose.html');
  writeFileSync(htmlPath, page({ panels, panelW, panelH, img, triggerWord }));
  const mp4 = join(outDir, 'before-after.mp4'), webm = join(outDir, 'before-after.webm');
  const { chromium } = requirePw('playwright');
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  try {
    const pg = await browser.newPage({ viewport: { width: even(32 + 2 * panelW + 16), height: even(28 + 40 + 10 + 30 + panelH) }, deviceScaleFactor: 1 });
    await pg.goto(pathToFileURL(htmlPath).href);
    await pg.evaluate(async rippleMs => {
      await Promise.all([...document.images].map(i => i.decode()));
      window.__video = { rippleMs, panels: [...document.querySelectorAll('.panel')].map(el => ({
        imgs: [...el.querySelectorAll('img')], shown: 0, ripple: el.querySelector('.ripple'),
        cursor: el.querySelector('.cursor'), key: el.querySelector('.key') })) };
    }, RIPPLE_MS);
    await pg.evaluate(p => p.forEach((ms, k) => { const v = window.__video.panels[k]; v.ms = ms; v.imgs[0].style.visibility = 'visible'; }),
      panels.map(p => p.frames.map(f => f.ms)));
    await encode(mp4, webm, async write => {
      for (const state of timeline) {
        await pg.evaluate(render, state);
        await write(await pg.screenshot({ type: 'jpeg', quality: 92 }));
      }
    });
  } finally {
    await browser.close().catch(() => {});
  }

  // QM chat previews .html attachments inline but offers video files only as downloads.
  const b64 = f => readFileSync(f).toString('base64');
  writeFileSync(join(outDir, 'player.html'), `<!doctype html><html><head><meta charset="utf-8"><title>Before and after</title><style>
html,body{margin:0;height:100%;background:#111418}video{display:block;width:100%;height:100%;object-fit:contain}</style></head><body>
<video autoplay muted loop playsinline controls>
<source type="video/webm" src="data:video/webm;base64,${b64(webm)}">
<source type="video/mp4" src="data:video/mp4;base64,${b64(mp4)}">
</video></body></html>`);
  return { durationS: round(timeline.length / FPS, 1), takes: [before.takeId, after.takeId],
    realSpeedMs: [round(start, 1), round(end, 1)], slowMotionMs: lo < hi ? [lo, hi] : null, notes };
}
