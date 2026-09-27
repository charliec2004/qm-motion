// Plain videos for the user, one per take, made by compare from the captured frames at their real timing.
// They add nothing to the evidence the model reads; the model never sees them.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { round, takePath } from './common.mjs';
import { frameSize } from './sheets.mjs';

const FPS = 60;
// 24x32 arrow cursor, tip at (1,1); headless Chromium draws none, so it is overlaid at the recorded pointer position.
const CURSOR_PNG = 'iVBORw0KGgoAAAANSUhEUgAAABgAAAAgCAYAAAAIXrg4AAADR0lEQVR4nLRVTUhUURT+3nPGkVLyJyUyEhUKzIULNyIZhGO6EsEo0SAlBVdKSdTCFhpBRIs2IQ6Gli2KYoIktIhpVExnZq1CIU1BkLSYYSRBnJnO9+aNis6f9vrgmzn33J/v3vPOuVcFcFb4TFiA/wBVeEHYpqqqW/5PwWCoOhEKhU6KyIKYVTAQXDxMo7+/H2azOVtRFKc0m2AQ1KjR3NyM2dlZ5OTkmKX5WtgNA0ABhUY4HEZlZSVcLheKioroeyy8j3+EuttRWloKt9utiQluCl8KzTgg1FjO/Px8zMzMoKGhgc2Lwg/CLBglQGRkZGBiYgIdHR1snhN+Fh6DUQJap6piZGQEAwMDbJ6RDPPI/2kYJRAFU3h8fJyChSLiwj5qJSUBorW1FZOTkwxdloh8QuTbGCdA1NbWYm5uTsnLy2NWvRBeTzZnXwJERUUFPB6PUlJSwuZDROpFMUyAkEJkrShVVdqnYMXbhRbDBIjc3Fw4HA40NjayyR+H8IhhAoTFYoHdbkd3t3Zt8Ti8jU/sHGMShmikpaUlXbCvr4/xj9mXnp6OjY0N1ohbF/sWFYgJn8+H3t5edHZ2orq6WvPxIuQVkgSs9rKoQMwQ+f1+WK1WjI2NYXBwcMvf09MTNR8gkjnx+C46cI9AIBBAXV1dNBS+qakprKysaH1NTU0oLi7mA9UpPIQUsPVkBoNBrK2taTtnKARPoFfr8PBwZLDcTXIK7jBbeDVVAe3JXF9f1yp1YYGJgOfCa8KPQq/NZgtvbm5qE7q6upCZmck5N5CgwKJg6pwX1jAUS0tL9D3VdxfWx1hE3FpWVoby8nK+2wyjIs9rjvTxqF8SCXAH94S39fYr4SXoqavjqPBXTU2N6nQ6Ncfq6ioKCwshp+JDVJdIgCH6o9u8vC7vWpz4LXwzPT2N5eVlzVFQUICWlhaaVkRSMi4Yoq/CH8JbwmCccX5hm8lkQn19vebg2z00NEQzXfgWCU7wU/goweLEe6F3dHQ0zGRgxi0uLkKubfZdEWbGm2hCauAHt0kB3m1vb8f8/HzY6/Xy+zG1bNgO8x4kTbMdOC78jkhYKchsu6P74iL5DbeNgPCwviCTgTv3J5u0nxMcCH8BAAD//4xaDzkAAAAGSURBVAMA8THvwO+TuJgAAAAASUVORK5CYII=';

// 60 fps: each tick shows the latest frame captured by then, advancing at most one frame per tick,
// so every captured frame is on screen at least once (a one-frame flash cannot be dropped).
export async function takeVideo({ take, name, outDir }) {
  const sc = take.manifest.scenario;
  const frames = take.frames;
  const start = frames[0].msFromTrigger, end = Math.max(sc.recordAfterMs, frames.at(-1).msFromTrigger);
  const ticks = [];
  for (let i = 0, shown = 0; start + i * (1000 / FPS) <= end; i++) {
    const t = start + i * (1000 / FPS);
    let target = shown;
    while (target + 1 < frames.length && frames[target + 1].msFromTrigger <= t) target++;
    shown = Math.min(target, shown + 1);
    ticks.push(shown);
  }

  const inputs = ['-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-'];
  let graph = '[0:v]pad=ceil(iw/2)*2:ceil(ih/2)*2';
  const tr = take.manifest.trigger;
  if (sc.trigger.action !== 'press' && Number.isFinite(tr.x) && Number.isFinite(tr.y)) {
    const size = await frameSize(takePath(take.takeId, frames[0].file));
    const k = size.width / sc.viewport.width;
    const cursor = join(outDir, 'cursor.png');
    writeFileSync(cursor, Buffer.from(CURSOR_PNG, 'base64'));
    inputs.push('-i', cursor);
    graph += `[v];[v][1:v]overlay=${Math.round(tr.x * k) - 1}:${Math.round(tr.y * k) - 1}`;
  }
  graph += ',format=yuv420p,split=2[mp4][webm]';
  const mp4 = join(outDir, `${name}.mp4`), webm = join(outDir, `${name}.webm`);
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', ...inputs, '-filter_complex', graph,
    '-map', '[mp4]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-movflags', '+faststart', mp4,
    '-map', '[webm]', '-c:v', 'libvpx-vp9', '-deadline', 'realtime', '-cpu-used', '8', '-b:v', '0', '-crf', '30', webm]);
  let err = '';
  ff.stderr.on('data', d => { err += d; });
  ff.stdin.on('error', () => {});
  const done = new Promise((resolve, reject) => ff.on('close', code => (code === 0 ? resolve() : reject(new Error(`ffmpeg failed: ${err.trim()}`)))));
  const jpeg = frames.map(f => readFileSync(takePath(take.takeId, f.file)));
  for (const i of ticks) if (!ff.stdin.write(jpeg[i])) await new Promise(r => ff.stdin.once('drain', r));
  ff.stdin.end();
  await done;

  // QM chat previews .html attachments inline but offers video files only as downloads.
  const b64 = f => readFileSync(f).toString('base64');
  const player = join(outDir, `${name}.html`);
  writeFileSync(player, `<!doctype html><html><head><meta charset="utf-8"><title>${name}</title><style>
html,body{margin:0;height:100%;background:#111}video{display:block;width:100%;height:100%;object-fit:contain}</style></head><body>
<video autoplay muted loop playsinline controls>
<source type="video/webm" src="data:video/webm;base64,${b64(webm)}">
<source type="video/mp4" src="data:video/mp4;base64,${b64(mp4)}">
</video></body></html>`);
  return { player, mp4, durationS: round(ticks.length / FPS, 2), framesShown: new Set(ticks).size, framesCaptured: frames.length };
}
