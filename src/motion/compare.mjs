// motion compare: before/after takes aligned on the trigger; one row per take, every frame in the window.
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { MOTION_DIR, UsageError, WORKSPACE, crop as parseCrop, fmtMs, loadTake, takePath } from './common.mjs';
import { buildTable } from './table.mjs';
import { cropBox, frameSize, renderSheets, tileSize } from './sheets.mjs';
import { FRAME_LAG_MS, framesIn, requireTrigger, takeWindow } from './inspect.mjs';
import { takeVideo } from './video.mjs';

const COLS = 8;
const MUST_MATCH = [
  ['url', s => s.url], ['viewport', s => s.viewport], ['deviceScaleFactor', s => s.deviceScaleFactor],
  ['reducedMotion', s => s.reducedMotion], ['ready', s => s.ready], ['setup', s => s.setup], ['trigger', s => s.trigger],
];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const ids = v => String(v ?? '').split(',').map(s => s.trim()).filter(Boolean);

export async function compare({ flags }) {
  const before = ids(flags.before), after = ids(flags.after);
  if (!before.length || !after.length) throw new UsageError('compare needs --before <id,id,id> and --after <id,id,id>');
  const takes = [...before.map((id, i) => ({ ...loadTake(id), label: `before ${i + 1}` })),
    ...after.map((id, i) => ({ ...loadTake(id), label: `after ${i + 1}` }))];
  takes.forEach(requireTrigger);

  const ref = takes[0];
  for (const t of takes.slice(1)) {
    for (const [field, get] of MUST_MATCH) {
      if (!same(get(ref.manifest.scenario), get(t.manifest.scenario)))
        throw new Error(`${field} differs: ${ref.takeId} has ${JSON.stringify(get(ref.manifest.scenario))}, ${t.takeId} has ${JSON.stringify(get(t.manifest.scenario))}; recapture with the same scenario`);
    }
    if (t.manifest.browser !== ref.manifest.browser)
      throw new Error(`browser differs: ${ref.takeId} has ${ref.manifest.browser}, ${t.takeId} has ${t.manifest.browser}; recapture with the same scenario`);
  }
  const warnings = [];
  if (takes.some(t => t.manifest.scenario.name !== ref.manifest.scenario.name)) warnings.push('scenario names differ');
  if (takes.some(t => !same(t.manifest.scenario.watch, ref.manifest.scenario.watch))) warnings.push('watch lists differ; tables may have different columns');
  if (before.length < 3 || after.length < 3) warnings.push('fewer than 3 takes on a side; a one-frame defect can be missed');
  const rev = t => JSON.stringify([t.manifest.app?.revision, t.manifest.app?.diffSha256]);
  const beforeRevs = new Set(takes.filter(t => t.label.startsWith('before')).map(rev));
  if (takes.filter(t => t.label.startsWith('after')).every(t => beforeRevs.has(rev(t))))
    warnings.push('before and after have the same app revision and diff; the after takes may not include your change');

  const { from, to } = takeWindow(takes, flags);
  const perTake = takes.map(t => framesIn(t, from, to));
  const outId = `compare-${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}-${randomBytes(2).toString('hex')}`;
  const outDir = join(WORKSPACE, MOTION_DIR, outId);
  mkdirSync(outDir, { recursive: true });

  // Consecutive time slices in which no take has more than one row of frames.
  const merged = perTake.flatMap((fs, k) => fs.map(f => ({ ...f, k }))).sort((a, b) => a.msFromTrigger - b.msFromTrigger);
  const slices = [];
  let cur = null;
  for (const f of merged) {
    if (!cur || cur[f.k].length === COLS) slices.push(cur = takes.map(() => []));
    cur[f.k].push(f);
  }

  const sheets = [];
  if (merged.length) {
    const first = merged[0];
    const size = await frameSize(takePath(takes[first.k].takeId, first.file));
    const { box, warning } = cropBox(parseCrop(flags), ref.manifest.scenario.viewport, size);
    if (warning) warnings.push(warning);
    const { W, H } = tileSize(box, 240);
    for (const slice of slices) {
      const rows = slice.map((fs, k) => ({
        tiles: fs.length
          ? fs.map((f, i) => ({ src: takePath(takes[k].takeId, f.file),
            label: `${fmtMs(f.msFromTrigger)} #${Number(f.file.match(/(\d+)\.jpg$/)[1])}`, rowLabel: i === 0 ? takes[k].label : null }))
          : [{ src: null, label: 'no frames', rowLabel: takes[k].label }],
      }));
      const all = slice.flat().map(f => f.msFromTrigger);
      const offset = sheets.length;
      const rendered = await renderSheets({ rows, cols: COLS, box, W, H, fontSize: 16,
        sheetPath: n => join(outDir, `sheet_p${offset + n}.png`) });
      for (const [n, s] of rendered.entries())
        sheets.push({ path: `${MOTION_DIR}/${outId}/sheet_p${offset + n + 1}.png`, fromMs: Math.min(...all), toMs: Math.max(...all),
          rows: s.rows.map(k => takes[k].label) });
    }
  }
  const rows = takes.map((t, k) => ({ label: t.label, takeId: t.takeId, frames: perTake[k].length,
    table: buildTable(t.manifest.scenario.watch, t.trace, from, to).rows }));
  // For the user only: plain videos of the first before and first after take. Never part of the evidence.
  let video = null;
  try {
    const rel = f => `${MOTION_DIR}/${outId}/${f.split('/').pop()}`;
    const b = await takeVideo({ take: takes[0], name: 'before', outDir });
    const a = await takeVideo({ take: takes[before.length], name: 'after', outDir });
    video = { attach: [rel(b.player), rel(a.player)], mp4: [rel(b.mp4), rel(a.mp4)],
      takes: { before: takes[0].takeId, after: takes[before.length].takeId },
      note: 'For the user, not for you: you cannot see these. Attach both players (they play inline in chat); in your reply label them Before and After and say where to look.' };
  } catch (e) { warnings.push(`user videos not made: ${e.message.split('\n')[0]}`); }
  const result = { ok: true, sheets, warnings, framesWindow: [from, to + FRAME_LAG_MS], rows, video,
    next: sheets.length ? 'call motion_view with each sheet path' : 'no frames in this window; widen --from/--to' };
  writeFileSync(join(outDir, 'compare.json'), JSON.stringify({ inputs: { before, after, from, to, crop: flags.crop ?? null }, ...result }, null, 2));
  return result;
}
