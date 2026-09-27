// Trace table: one row per sample where a watched value differs from the last printed row.
import { fmtMs, round } from './common.mjs';

const GEOMETRY = new Set(['x', 'y', 'width', 'height']);
const BASE = ['x', 'y', 'width', 'height', 'opacity', 'display', 'visibility', 'hidden'];

function fieldsOf(watch) {
  return watch.flatMap(w => [
    ...BASE.map(f => ({ col: `${w.name} ${f}`, get: e => e?.[f], geometry: GEOMETRY.has(f) })),
    ...(w.attributes ?? []).map(a => ({ col: `${w.name} ${a}`, get: e => e?.attributes?.[a] })),
    ...(w.styles ?? []).map(s => ({ col: `${w.name} ${s}`, get: e => e?.styles?.[s] })),
  ].map(f => ({ ...f, name: w.name })));
}

const value = (f, sample) => {
  const el = sample.elements[f.name];
  return el === null || el === undefined ? null : f.get(el) ?? null;
};

function differs(f, a, b) {
  if (a === null || b === null) return a !== b;
  if (f.geometry) return Math.abs(a - b) >= 0.5;
  return a !== b;
}

const show = v => (v === null ? 'null' : typeof v === 'number' ? round(v).toFixed(2) : String(v));

// Returns row strings: header first. Samples outside [from, to] are ignored.
export function buildTable(watch, trace, from, to) {
  const samples = trace.filter(s => s.msFromTrigger !== null && s.msFromTrigger >= from && s.msFromTrigger <= to);
  if (!watch.length || !samples.length) return { rows: [], samples: samples.length };
  const fields = fieldsOf(watch);
  const printed = [samples[0]];
  let last = samples[0];
  for (const s of samples.slice(1, -1)) {
    if (fields.some(f => differs(f, value(f, last), value(f, s)))) { printed.push(s); last = s; }
  }
  if (samples.length > 1) printed.push(samples.at(-1));
  const cols = fields.filter(f => printed.some((s, i) => i > 0 && differs(f, value(f, printed[i - 1]), value(f, s))));
  const cells = [['ms', ...cols.map(f => f.col)],
    ...printed.map(s => [fmtMs(s.msFromTrigger), ...cols.map(f => show(value(f, s)))])];
  const widths = cells[0].map((_, i) => Math.max(...cells.map(r => r[i].length)));
  return { rows: cells.map(r => r.map((c, i) => c.padEnd(widths[i])).join('  ').trimEnd()), samples: samples.length };
}
