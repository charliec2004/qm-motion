// motion inspect: trace table for one take plus sheets holding every frame in the window.
import { mkdirSync } from 'node:fs';
import { CLI, MOTION_DIR, UsageError, crop as parseCrop, fmtMs, loadTake, num, takePath } from './common.mjs';
import { buildTable } from './table.mjs';
import { cropBox, frameSize, renderSheets, tileSize } from './sheets.mjs';

export const FRAME_LAG_MS = 30;

// Window defaults to the whole take; frames extend to `to + 30` because they arrive after the paint.
export function takeWindow(takes, flags) {
  const all = takes.flatMap(t => [...t.frames, ...t.trace].map(x => x.msFromTrigger)).filter(x => x !== null);
  const from = num(flags, 'from', Math.floor(Math.min(...all)));
  const to = num(flags, 'to', Math.ceil(Math.max(...all)));
  if (!(from < to)) throw new UsageError(`--from must be less than --to (got ${from} and ${to})`);
  return { from, to };
}

export const framesIn = (take, from, to) =>
  take.frames.filter(f => f.msFromTrigger !== null && f.msFromTrigger >= from && f.msFromTrigger <= to + FRAME_LAG_MS);

export function requireTrigger(take) {
  if (!take.manifest.trigger?.wallMs) throw new Error(`take ${take.takeId} has no trigger time (the trigger never fired); recapture it`);
}

export async function inspect({ flags, positional }) {
  if (positional.length !== 1) throw new UsageError('inspect needs exactly one <take-id>');
  const take = loadTake(positional[0]);
  requireTrigger(take);
  const { from, to } = takeWindow([take], flags);
  const crop = parseCrop(flags);
  const { scenario } = take.manifest;
  const { rows: table, samples } = buildTable(scenario.watch, take.trace, from, to);
  if (scenario.watch.length && !samples) throw new Error(`no trace samples between ${from} and ${to} ms; widen --from/--to (the take spans ${fmtMs(take.trace[0]?.msFromTrigger ?? 0)} to ${fmtMs(take.trace.at(-1)?.msFromTrigger ?? 0)} ms)`);
  const frames = framesIn(take, from, to);
  const warnings = [];
  let sheets = [];
  if (frames.length) {
    const size = await frameSize(takePath(take.takeId, frames[0].file));
    const { box, tag, warning } = cropBox(crop, scenario.viewport, size);
    if (warning) warnings.push(warning);
    const { W, H } = tileSize(box, 400);
    const cols = 4;
    const rows = [];
    for (let i = 0; i < frames.length; i += cols) {
      rows.push({ frames: frames.slice(i, i + cols) });
    }
    const dir = takePath(take.takeId, 'sheets');
    mkdirSync(dir, { recursive: true });
    const name = n => `sheets/inspect_${from}_${to}_${tag}_p${n}.png`;
    const rendered = await renderSheets({
      rows: rows.map(r => ({ tiles: r.frames.map(f => ({ src: takePath(take.takeId, f.file),
        label: `${fmtMs(f.msFromTrigger)} ms #${Number(f.file.match(/(\d+)\.jpg$/)[1])}` })) })),
      cols, box, W, H, fontSize: 22, sheetPath: n => takePath(take.takeId, name(n)),
    });
    sheets = rendered.map((s, n) => {
      const fs = s.rows.flatMap(k => rows[k].frames);
      return { path: `${MOTION_DIR}/${take.takeId}/${name(n + 1)}`, fromMs: fs[0].msFromTrigger, toMs: fs.at(-1).msFromTrigger, frames: fs.length };
    });
  }
  return {
    ok: true, takeId: take.takeId, table,
    ...(scenario.watch.length ? {} : { tableNote: 'scenario has no watch list; sheets only' }),
    framesWindow: [from, to + FRAME_LAG_MS], frames: frames.length, sheets,
    ...(warnings.length ? { warnings } : {}),
    next: sheets.length
      ? 'call motion_view with the sheet covering the moment you care about'
      : `no frames in this window; widen it: ${CLI} inspect ${take.takeId} --from <ms> --to <ms>`,
  };
}
