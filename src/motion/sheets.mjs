// Sheet rendering with FFmpeg: labelled tiles -> rows -> sheets within 2000x2000 px and 4.5 MiB.
import { execFile } from 'node:child_process';
import { copyFileSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
const FONT = '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf';
export const MAX_PX = 2000;
const MAX_BYTES = 4.5 * 1024 * 1024;
const GAP = 4;
const even = n => Math.max(2, Math.round(n / 2) * 2);

async function ffmpeg(args) {
  await run('ffmpeg', ['-v', 'error', '-y', ...args], { maxBuffer: 16 << 20 });
}

export async function frameSize(file) {
  const { stdout } = await run('ffprobe', ['-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file]);
  const [width, height] = stdout.trim().split(',').map(Number);
  return { width, height };
}

// CSS-pixel crop -> frame-pixel box, clamped to the frame.
export function cropBox(crop, viewport, size) {
  if (!crop) return { box: { x: 0, y: 0, w: size.width, h: size.height }, tag: 'full', warning: null };
  const k = size.width / viewport.width;
  const x = Math.max(0, Math.round(crop.x * k));
  const y = Math.max(0, Math.round(crop.y * k));
  const w = Math.min(size.width - x, Math.round(crop.w * k));
  const h = Math.min(size.height - y, Math.round(crop.h * k));
  if (w < 2 || h < 2) throw new Error(`--crop lies outside the ${size.width}x${size.height} frame`);
  const clamped = x !== Math.round(crop.x * k) || y !== Math.round(crop.y * k) || w !== Math.round(crop.w * k) || h !== Math.round(crop.h * k);
  return { box: { x, y, w, h }, tag: `${crop.x}-${crop.y}-${crop.w}-${crop.h}`,
    warning: clamped ? `crop clamped to the ${size.width}x${size.height} frame` : null };
}

// Tile size for a box at a target width; shrinks only if one tile would be taller than a sheet.
export function tileSize(box, width) {
  let W = width, H = even(width * box.h / box.w);
  if (H > MAX_PX) { H = MAX_PX; W = even(MAX_PX * box.w / box.h); }
  return { W: even(W), H };
}

const esc = s => s.replace(/[:'\\%]/g, '');
const text = (s, size, y) => `drawtext=fontfile=${FONT}:text='${esc(s)}':fontsize=${size}:fontcolor=white:box=1:boxcolor=black@0.7:x=6:y=${y}`;

async function tile({ src, out, box, W, H, label, rowLabel, fontSize }) {
  const filters = [src ? `format=rgb24,crop=${box.w}:${box.h}:${box.x}:${box.y},scale=${W}:${H}` : 'format=rgb24'];
  if (label) filters.push(text(label, fontSize, 6));
  if (rowLabel) filters.push(text(rowLabel, fontSize, 'h-th-6'));
  const input = src ? ['-i', src] : ['-f', 'lavfi', '-i', `color=c=0xdddddd:s=${W}x${H}`];
  await ffmpeg([...input, '-vf', filters.join(','), '-frames:v', '1', out]);
}

async function grid(files, cols, rows, out, dir) {
  const seq = mkdtempSync(join(dir, 'g-'));
  files.forEach((f, i) => copyFileSync(f, join(seq, `${String(i + 1).padStart(4, '0')}.png`)));
  await ffmpeg(['-framerate', '1', '-start_number', '1', '-i', join(seq, '%04d.png'),
    '-vf', `tile=${cols}x${rows}:padding=${GAP}:color=white`, '-frames:v', '1', out]);
}

async function pool(items, fn, n = 6) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) await fn(items[i++]); }));
}

// rows: [{ tiles: [{ src|null, label, rowLabel? }] }] rendered left to right, `cols` per row.
// sheetPath(n) names sheet n (from 1). Returns [{ path, rows: [row indices] }].
export async function renderSheets({ rows, cols, box, W, H, fontSize, sheetPath }) {
  const dir = mkdtempSync(join(tmpdir(), 'motion-'));
  try {
    const rowFiles = [];
    await pool(rows.flatMap((r, ri) => r.tiles.map((t, ti) => ({ ...t, out: join(dir, `t${ri}_${ti}.png`) }))),
      t => tile({ ...t, box, W, H, fontSize }));
    for (const [ri, r] of rows.entries()) {
      const out = join(dir, `r${ri}.png`);
      await grid(r.tiles.map((_, ti) => join(dir, `t${ri}_${ti}.png`)), cols, 1, out, dir);
      rowFiles.push(out);
    }
    const perSheet = Math.max(1, Math.floor((MAX_PX + GAP) / (H + GAP)));
    const chunks = [];
    for (let i = 0; i < rows.length; i += perSheet) chunks.push(rows.map((_, k) => k).slice(i, i + perSheet));
    const sheets = [];
    const render = async idx => {
      const path = sheetPath(sheets.length + 1);
      await grid(idx.map(k => rowFiles[k]), 1, idx.length, path, dir);
      if (statSync(path).size > MAX_BYTES && idx.length > 1) {
        const half = Math.ceil(idx.length / 2);
        await render(idx.slice(0, half));
        await render(idx.slice(half));
        return;
      }
      sheets.push({ path, rows: idx });
    };
    for (const c of chunks) await render(c);
    return sheets;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
