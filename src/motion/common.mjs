// Shared helpers: argument parsing, JSON output, take paths.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const WORKSPACE = '/root/workspace';
export const MOTION_DIR = 'artifacts/motion';
export const CLI = `node ${WORKSPACE}/motion/cli.mjs`;

export class UsageError extends Error {}

// `--flag value` or `--flag=value`; values may start with "-" (for example `--from -100`).
export function parseArgs(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) { positional.push(arg); continue; }
    const eq = arg.indexOf('=');
    if (eq > 0) flags[arg.slice(2, eq)] = arg.slice(eq + 1);
    else if (i + 1 < argv.length) flags[arg.slice(2)] = argv[++i];
    else throw new UsageError(`${arg} needs a value`);
  }
  return { flags, positional };
}

export function num(flags, name, fallback) {
  if (flags[name] === undefined) return fallback;
  const n = Number(flags[name]);
  if (!Number.isFinite(n)) throw new UsageError(`--${name} must be a number (got ${flags[name]})`);
  return n;
}

export function crop(flags) {
  if (flags.crop === undefined) return null;
  const parts = flags.crop.split(',').map(Number);
  if (parts.length !== 4 || parts.some(n => !Number.isFinite(n)) || parts[2] <= 0 || parts[3] <= 0)
    throw new UsageError(`--crop must be x,y,w,h in CSS pixels with positive w and h (got ${flags.crop})`);
  const [x, y, w, h] = parts;
  return { x, y, w, h };
}

export const progress = (...args) => console.error('[motion]', ...args);

export function takePath(takeId, ...rest) {
  if (!/^[A-Za-z0-9-]+$/.test(takeId)) throw new UsageError(`not a take ID: ${takeId}`);
  return join(WORKSPACE, MOTION_DIR, takeId, ...rest);
}

export function loadTake(takeId) {
  let manifest;
  try { manifest = JSON.parse(readFileSync(takePath(takeId, 'manifest.json'), 'utf8')); }
  catch { throw new Error(`no take ${takeId} (expected ${MOTION_DIR}/${takeId}/manifest.json); copy a takeId printed by motion capture`); }
  const frames = JSON.parse(readFileSync(takePath(takeId, 'frames.json'), 'utf8'));
  const trace = JSON.parse(readFileSync(takePath(takeId, 'trace.json'), 'utf8'));
  return { takeId, manifest, frames, trace };
}

export const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
export const fmtMs = ms => (ms >= 0 ? '+' : '') + ms.toFixed(1);
