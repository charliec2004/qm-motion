// User-facing player: raw captured images follow a shared trigger-relative clock.
// Separate encoded clips stay downloadable; they are not the clock or frame source.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { takePath } from './common.mjs';
import { frameAt, stepTime, mountPlayback } from './playback.mjs';

const finite = n => typeof n === 'number' && Number.isFinite(n);
const json = data => JSON.stringify(data).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

export function observedEndMs(take) {
  const end = take.manifest.recording?.endedWallMs;
  if (finite(end)) return end - take.manifest.trigger.wallMs;
  // Older takes did not save recording boundaries; use their observed evidence,
  // never a requested post-trigger duration (which changes meaning on rebasing).
  return Math.max(0, ...take.frames.map(f => f.msFromTrigger).filter(finite),
    ...(take.trace ?? []).map(s => s.msFromTrigger).filter(finite));
}

export function comparisonBounds(takes) {
  return { fromMs: Math.min(0, ...takes.flatMap(t => t.frames.map(f => f.msFromTrigger)).filter(finite)),
    toMs: Math.max(0, ...takes.map(observedEndMs)) };
}

export function validateMarkers(markers, { fromMs, toMs }) {
  if (!Array.isArray(markers)) throw new Error('markers must be an array');
  markers.forEach((marker, i) => {
    if (!marker || !finite(marker.fromMs) || !finite(marker.toMs) || marker.fromMs > marker.toMs ||
      marker.fromMs < fromMs || marker.toMs > toMs || typeof marker.label !== 'string' || typeof marker.description !== 'string')
      throw new Error(`marker ${i + 1} needs label, description and finite fromMs <= toMs inside ${fromMs}..${toMs} ms`);
  });
}

/**
 * Additive API for compare. before/after are arrays of loadTake() results.
 * markers: [{fromMs,toMs,label,description}], all times relative to the trigger.
 * clips: [{path,label}] existing MP4/WebM files, embedded as downloads.
 * interval: optional {fromMs,toMs}; defaults to the union of capture ranges.
 * readFrame is a file-reader seam for local fixtures, not a new capture source.
 */
export function buildComparisonPlayer({ before, after, markers = [], clips = [], interval = null,
  readFrame = (take, frame) => readFileSync(takePath(take.takeId, frame.file)) }) {
  const warnings = [];
  const pack = (takes, side) => {
    if (!Array.isArray(takes) || !takes.length) throw new Error(`${side} needs at least one take`);
    return takes.map(take => {
      if (!finite(take.manifest?.trigger?.wallMs)) throw new Error(`take ${take.takeId} has no recorded trigger time`);
      const frames = take.frames.map((frame, i) => {
        if (!finite(frame.msFromTrigger)) throw new Error(`take ${take.takeId} frame ${i + 1} has no capture timestamp`);
        let src = null;
        try { src = 'data:image/jpeg;base64,' + Buffer.from(readFrame(take, frame)).toString('base64'); }
        catch (error) { warnings.push(`${take.takeId} ${frame.file}: frame unavailable (${error.code ?? 'read failed'})`); }
        return { ms: frame.msFromTrigger, id: frame.file.match(/(\d+)\.jpg$/)?.[1] ?? String(i + 1), src };
      }).sort((a, b) => a.ms - b.ms);
      const endMs = observedEndMs(take);
      if (take.manifest.status === 'partial') warnings.push(`${take.takeId}: partial capture (${take.manifest.error ?? 'sequence incomplete'})`);
      return { takeId: take.takeId, trigger: take.manifest.trigger.event ?? 'recorded event', frames, endMs,
        startMs: frames[0]?.ms ?? -(take.manifest.scenario?.recordBeforeMs ?? 0),
        timing: take.manifest.timingSource ?? 'Recorded CDP timestamps; capture latency is not corrected.' };
    });
  };
  const data = { before: pack(before, 'before'), after: pack(after, 'after'), markers, clips: [] };
  const all = [...data.before, ...data.after];
  data.fromMs = interval?.fromMs ?? Math.min(0, ...all.map(t => t.startMs));
  data.toMs = interval?.toMs ?? Math.max(0, ...all.map(t => t.endMs));
  if (!finite(data.fromMs) || !finite(data.toMs) || data.fromMs >= data.toMs) throw new Error('player interval needs finite fromMs < toMs');
  validateMarkers(markers, data);
  for (const clip of clips) {
    if (!/\.(mp4|webm)$/i.test(clip.path)) throw new Error('download clips must be MP4 or WebM');
    const name = clip.path.split('/').pop();
    try {
      data.clips.push({ name, label: clip.label ?? name,
        src: `data:video/${name.toLowerCase().endsWith('.mp4') ? 'mp4' : 'webm'};base64,${readFileSync(clip.path).toString('base64')}` });
    } catch (error) { warnings.push(`${name}: download unavailable (${error.code ?? 'read failed'})`); }
  }
  const pane = side => `<section><header><strong>${side === 'before' ? 'Before' : 'After'}</strong><label>Take <select id="${side}-take" aria-label="${side} take"></select></label></header>
<div class="picture"><img id="${side}-image" alt="${side} captured frame"><span id="${side}-empty"></span></div>
<div class="frame" id="${side}-time"></div><div class="identity" id="${side}-identity"></div>
<div class="steps"><button id="${side}-prev" aria-label="Previous ${side} frame">← Frame</button><button id="${side}-next" aria-label="Next ${side} frame">Frame →</button></div></section>`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Before / After · QM Motion</title><style>
*{box-sizing:border-box}body{margin:0;background:#111827;color:#e5e7eb;font:12px system-ui,sans-serif;padding:10px}button,select{font:inherit;background:#25324a;color:inherit;border:1px solid #52617a;border-radius:5px;padding:5px;cursor:pointer}button:disabled{opacity:.4;cursor:default}button:focus-visible,select:focus-visible,input:focus-visible,a:focus-visible{outline:2px solid #93c5fd;outline-offset:2px}header,.controls,.steps{display:flex;align-items:center;gap:8px;justify-content:space-between}header{margin-bottom:5px}header label{min-width:0}select{max-width:180px}.panes{display:grid;grid-template-columns:1fr 1fr;gap:10px}.picture{height:clamp(80px,37vh,190px);background:#070b13;display:flex;align-items:center;justify-content:center;overflow:hidden;border-radius:5px}.picture img{width:100%;height:100%;object-fit:contain}.picture [hidden]{display:none}.picture span{color:#cbd5e1}.frame{font-variant-numeric:tabular-nums;margin-top:5px}.identity{font-size:10px;color:#a5b4cc;overflow-wrap:anywhere;margin:3px 0}.steps{justify-content:flex-start}.controls{justify-content:flex-start;margin-top:9px;flex-wrap:wrap}#clock{margin-left:auto;font-variant-numeric:tabular-nums}#seek{display:block;width:100%;margin:8px 0;accent-color:#60a5fa}#markers{display:flex;gap:6px;flex-wrap:wrap}#markers button[aria-pressed=true]{border-color:#93c5fd;background:#26466d}#where{margin:5px 0;color:#bfdbfe}details{color:#a5b4cc;margin-top:6px}details p{margin:5px 0}#downloads{display:flex;gap:12px;margin-top:6px;flex-wrap:wrap}a{color:#93c5fd}@media(max-width:480px){body{padding:6px}header{align-items:flex-start;flex-direction:column}select{max-width:145px}.panes{gap:6px}.frame{font-size:10px}.identity{font-size:9px}}
</style></head><body><main><div class="panes">${pane('before')}${pane('after')}</div>
<div class="controls"><button id="play">Play</button><button id="trigger">Trigger · 0 ms</button><label>Speed <select id="speed" aria-label="Playback speed"><option value="0.25">0.25×</option><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="2">2×</option></select></label><output id="clock" aria-live="off"></output></div>
<input id="seek" type="range" step="0.1" aria-label="Shared trigger-relative time"><div id="markers" aria-label="Relevant intervals"></div><p id="where" aria-live="polite"></p>
<details><summary>Timing and capture limits · clip downloads</summary><p>Both sides share elapsed time from their own recorded trigger. Frame buttons jump to that side's actual capture timestamp; the other side shows its latest captured frame. Between captures an image is held, not interpolated. Missing files and times outside a take are unavailable.</p><p>Playback uses captured images and timestamps, not encoded video frame numbers. Browser refresh may skip images during playback; step to inspect every captured frame. Downloads use the existing 60 fps encoding and may repeat or shift frames to preserve them.</p><p id="timing"></p><p id="warnings"></p><div id="downloads"></div></details></main>
<script>const data=${json(data)};const frameAt=${frameAt.toString()};const stepTime=${stepTime.toString()};(${mountPlayback.toString()})(data);document.getElementById('timing').textContent=[...new Set([...data.before,...data.after].map(t=>t.timing))].join(' ');document.getElementById('warnings').textContent=${json(warnings.join('; '))};</script></body></html>`;
  return { html, warnings, takes: { before: data.before.map(t => t.takeId), after: data.after.map(t => t.takeId) }, interval: [data.fromMs, data.toMs] };
}

export function comparisonPlayer({ outDir, name = 'comparison', ...options }) {
  if (!/^[a-zA-Z0-9-]+$/.test(name)) throw new Error('player name must contain only letters, numbers and hyphens');
  const result = buildComparisonPlayer(options);
  const player = join(outDir, `${name}.html`);
  writeFileSync(player, result.html);
  const { html, ...metadata } = result;
  return { player, ...metadata };
}
