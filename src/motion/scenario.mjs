// Scenario file: JSON data describing one interaction. No target-specific logic.
import { readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { WORKSPACE } from './common.mjs';

export const SCENARIO_HELP = `Scenario file: JSON describing one interaction. Write one anywhere under
/root/workspace and pass it to: capture --scenario <file.json>

{
  "name": "menu-close",                 // required: short identifier
  "url": "http://localhost:4173/",      // required: page to open inside this computer
  "appDir": "/root/workspace/my-app",   // optional: Git working copy; records app revision + diff hash
  "viewport": { "width": 960, "height": 720 },  // optional, default 960x720
  "deviceScaleFactor": 1,               // optional, default 1
  "reducedMotion": "no-preference",     // optional: "no-preference" (default) or "reduce"
  "ready": { "selector": ".menu", "settleMs": 350 },
                                        // optional: CSS selector that must be visible before the take
                                        // (10 s timeout), then wait settleMs (default 350)
  "setup": [                            // optional: actions to reach the starting state; not recorded
    { "action": "click", "role": "button", "name": "Open menu", "settleMs": 350 }
  ],
  "trigger": { "action": "click", "role": "button", "name": "Close", "exact": true },
                                        // required: the action every time is measured from.
                                        // action: "click" | "hover" | "press"
                                        // target: role + name (+ exact), via Playwright getByRole,
                                        //   or "selector": "<css>"
                                        // press also needs "key", e.g. "Escape"; without a target
                                        //   it presses on the page
  "watch": [                            // optional, 0-10 elements traced every display frame
    { "name": "panel", "selector": ".menu .panel",
      "attributes": ["data-state"],     //   optional DOM attributes to trace
      "styles": ["transform"] }         //   optional computed styles to trace
  ],                                    // watch names WHERE to look; the first match is traced.
                                        // Always traced: x, y, width, height, opacity, display,
                                        // visibility, hidden. Without watch, inspect gives sheets only.
  "recordBeforeMs": 300,                // optional, default 300: recorded before the trigger
  "recordAfterMs": 800                  // optional, default 800: recorded after (total <= 10000)
}
(Comments are for explanation only; the file itself must be plain JSON.)
`;

const ACTIONS = ['click', 'hover', 'press'];

function checkAction(a, field) {
  if (!a || typeof a !== 'object') throw new Error(`scenario ${field} must be an object`);
  if (!ACTIONS.includes(a.action)) throw new Error(`scenario ${field}.action must be click, hover or press (got ${JSON.stringify(a.action)})`);
  const byRole = a.role !== undefined || a.name !== undefined;
  if (byRole && a.selector !== undefined) throw new Error(`scenario ${field}: use role + name or selector, not both`);
  if (byRole && (typeof a.role !== 'string' || typeof a.name !== 'string')) throw new Error(`scenario ${field}: role and name must both be strings`);
  if (a.selector !== undefined && typeof a.selector !== 'string') throw new Error(`scenario ${field}.selector must be a CSS selector string`);
  if (a.action === 'press' && typeof a.key !== 'string') throw new Error(`scenario ${field}: press needs "key", for example "Escape"`);
  if (a.action !== 'press' && !byRole && a.selector === undefined) throw new Error(`scenario ${field}: ${a.action} needs role + name or selector`);
  if (a.settleMs !== undefined && !(a.settleMs >= 0)) throw new Error(`scenario ${field}.settleMs must be a number >= 0`);
}

export function loadScenario(file) {
  const path = isAbsolute(file) ? file : join(WORKSPACE, file);
  let s;
  try { s = JSON.parse(readFileSync(path, 'utf8')); }
  catch (e) { throw new Error(`could not read scenario ${path}: ${e.message}. See: help scenario`); }
  if (typeof s.name !== 'string' || !s.name) throw new Error('scenario name is required (a short identifier)');
  if (typeof s.url !== 'string' || !/^https?:\/\//.test(s.url)) throw new Error('scenario url is required (http:// or https:// page inside this computer)');
  checkAction(s.trigger, 'trigger');
  if (s.setup !== undefined) {
    if (!Array.isArray(s.setup)) throw new Error('scenario setup must be an array of actions');
    s.setup.forEach((a, i) => checkAction(a, `setup[${i}]`));
  }
  const watch = s.watch ?? [];
  if (!Array.isArray(watch) || watch.length > 10) throw new Error('scenario watch must be an array of 0-10 elements');
  watch.forEach((w, i) => {
    if (typeof w?.name !== 'string' || typeof w?.selector !== 'string') throw new Error(`scenario watch[${i}] needs name and selector strings`);
    for (const k of ['attributes', 'styles'])
      if (w[k] !== undefined && !(Array.isArray(w[k]) && w[k].every(x => typeof x === 'string'))) throw new Error(`scenario watch[${i}].${k} must be an array of strings`);
  });
  if (new Set(watch.map(w => w.name)).size !== watch.length) throw new Error('scenario watch names must be unique');
  const viewport = s.viewport ?? { width: 960, height: 720 };
  if (!(viewport.width > 0 && viewport.height > 0)) throw new Error('scenario viewport needs positive width and height');
  const reducedMotion = s.reducedMotion ?? 'no-preference';
  if (!['no-preference', 'reduce'].includes(reducedMotion)) throw new Error('scenario reducedMotion must be "no-preference" or "reduce"');
  const out = {
    name: s.name, url: s.url, appDir: s.appDir ?? null, viewport,
    deviceScaleFactor: s.deviceScaleFactor ?? 1, reducedMotion,
    ready: s.ready ? { selector: s.ready.selector ?? null, settleMs: s.ready.settleMs ?? 350 } : null,
    setup: s.setup ?? [], trigger: s.trigger, watch,
    recordBeforeMs: s.recordBeforeMs ?? 300, recordAfterMs: s.recordAfterMs ?? 800,
  };
  if (!(out.recordBeforeMs >= 0 && out.recordAfterMs >= 0 && out.recordBeforeMs + out.recordAfterMs <= 10000))
    throw new Error('scenario recordBeforeMs and recordAfterMs must be >= 0 with a total of at most 10000');
  return { path, scenario: out };
}
