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
For sequences, replace trigger with "actions": [{"id":"close","atMs":0,"action":"click","selector":"button"},{"id":"reopen","atMs":100,"action":"click","selector":"button"}].
"alignAction":"reopen" selects the observed action used as zero. At most 32 actions; before + last atMs + after <= 10000 ms. navigate actions use "url".
(Comments are for explanation only; the file itself must be plain JSON.)
`;

const ACTIONS = ['click', 'hover', 'press', 'navigate'];
const finiteNonnegative = n => typeof n === 'number' && Number.isFinite(n) && n >= 0;

function checkAction(a, field) {
  if (!a || typeof a !== 'object') throw new Error(`scenario ${field} must be an object`);
  if (!ACTIONS.includes(a.action)) throw new Error(`scenario ${field}.action must be click, hover, press or navigate (got ${JSON.stringify(a.action)})`);
  if (a.action === 'navigate') {
    if (typeof a.url !== 'string' || !/^https?:\/\//.test(a.url)) throw new Error(`scenario ${field}.url must be an HTTP URL`);
    return;
  }
  const byRole = a.role !== undefined || a.name !== undefined;
  if (byRole && a.selector !== undefined) throw new Error(`scenario ${field}: use role + name or selector, not both`);
  if (byRole && (typeof a.role !== 'string' || typeof a.name !== 'string')) throw new Error(`scenario ${field}: role and name must both be strings`);
  if (a.selector !== undefined && typeof a.selector !== 'string') throw new Error(`scenario ${field}.selector must be a CSS selector string`);
  if (a.action === 'press' && typeof a.key !== 'string') throw new Error(`scenario ${field}: press needs "key", for example "Escape"`);
  if (a.action !== 'press' && !byRole && a.selector === undefined) throw new Error(`scenario ${field}: ${a.action} needs role + name or selector`);
  if (a.settleMs !== undefined && !finiteNonnegative(a.settleMs)) throw new Error(`scenario ${field}.settleMs must be a number >= 0`);
}

export function loadScenario(file) {
  const path = isAbsolute(file) ? file : join(WORKSPACE, file);
  let s;
  try { s = JSON.parse(readFileSync(path, 'utf8')); }
  catch (e) { throw new Error(`could not read scenario ${path}: ${e.message}. See: help scenario`); }
  if (typeof s.name !== 'string' || !s.name) throw new Error('scenario name is required (a short identifier)');
  if (typeof s.url !== 'string' || !/^https?:\/\//.test(s.url)) throw new Error('scenario url is required (http:// or https:// page inside this computer)');
  const { actions, alignAction } = normalizeSequence(s);
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
  if (!(Number.isInteger(viewport.width) && Number.isInteger(viewport.height) && viewport.width > 0 && viewport.height > 0 && viewport.width <= 4096 && viewport.height <= 4096)) throw new Error('scenario viewport needs positive width and height');
  if (s.ready?.settleMs !== undefined && (!finiteNonnegative(s.ready.settleMs) || s.ready.settleMs > 10000)) throw new Error('scenario ready.settleMs must be finite and between 0 and 10000');
  if (s.deviceScaleFactor !== undefined && !(typeof s.deviceScaleFactor === 'number' && Number.isFinite(s.deviceScaleFactor) && s.deviceScaleFactor > 0 && s.deviceScaleFactor <= 4)) throw new Error('scenario deviceScaleFactor must be finite, positive and <= 4');
  if (s.demonstration?.unsupported?.length) throw new Error(`demonstration has unsupported actions: ${s.demonstration.unsupported.join('; ')}. Record again without these actions.`);
  const reducedMotion = s.reducedMotion ?? 'no-preference';
  if (!['no-preference', 'reduce'].includes(reducedMotion)) throw new Error('scenario reducedMotion must be "no-preference" or "reduce"');
  const out = {
    name: s.name, url: s.url, appDir: s.appDir ?? null, viewport,
    deviceScaleFactor: s.deviceScaleFactor ?? 1, reducedMotion,
    ready: s.ready ? { selector: s.ready.selector ?? null, settleMs: s.ready.settleMs ?? 350 } : null,
    setup: s.setup ?? [], trigger: actions.find(a => a.id === alignAction), actions, alignAction, watch,
    ...(s.demonstration ? { demonstration: s.demonstration } : {}),
    recordBeforeMs: s.recordBeforeMs ?? 300, recordAfterMs: s.recordAfterMs ?? 800,
  };
  if (!(finiteNonnegative(out.recordBeforeMs) && finiteNonnegative(out.recordAfterMs) && out.recordBeforeMs + actions.at(-1).atMs + out.recordAfterMs <= 10000))
    throw new Error('scenario recordBeforeMs and recordAfterMs must be >= 0 with before + last action offset + after at most 10000 ms');
  return { path, scenario: out };
}

// Public sequence contract for capture, recording export, inspect and compare.
// atMs is a requested offset from the first action's dispatch, never an observed time.
export function normalizeSequence(s) {
  if (s.actions !== undefined && s.trigger !== undefined) throw new Error('scenario: use actions or trigger, not both');
  const source = s.actions ?? [{ ...s.trigger, id: 'trigger', atMs: 0 }];
  if (!Array.isArray(source) || !source.length || source.length > 32) throw new Error('scenario actions must contain 1-32 actions');
  let previous = -1;
  const actions = source.map((a, i) => {
    checkAction(a, `actions[${i}]`);
    const id = a.id ?? `action-${i + 1}`;
    const atMs = a.atMs ?? (i === 0 ? 0 : undefined);
    if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(id)) throw new Error(`scenario actions[${i}].id must be a short identifier`);
    if (!finiteNonnegative(atMs) || atMs < previous || (i === 0 && atMs !== 0)) throw new Error('scenario action atMs offsets must start at 0 and be nondecreasing finite numbers');
    previous = atMs;
    return { ...a, id, atMs };
  });
  if (new Set(actions.map(a => a.id)).size !== actions.length) throw new Error('scenario action IDs must be unique');
  const alignAction = s.alignAction ?? actions[0].id;
  if (!actions.some(a => a.id === alignAction)) throw new Error(`scenario alignAction ${JSON.stringify(alignAction)} is not an action ID`);
  return { actions, alignAction };
}

// Returns copies rebased to a selected observed event, retaining complete action context.
// Existing manifests without actions can still align to their single trigger.
export function alignTake(take, actionId = take.manifest.scenario.alignAction ?? 'trigger') {
  const m = take.manifest;
  const anchor = m.actions ? m.actions.find(a => a.id === actionId)?.event : (actionId === 'trigger' ? m.trigger : null);
  if (!Number.isFinite(anchor?.wallMs)) throw new Error(`take ${take.takeId}: action ${actionId} has no observed event; inspect partial results or recapture`);
  const old = m.trigger?.wallMs;
  const rebase = item => ({ ...item, msFromTrigger: Number.isFinite(item.wallMs) ? Math.round((item.wallMs - anchor.wallMs) * 10) / 10 : item.msFromTrigger === null ? null : Math.round((item.msFromTrigger + old - anchor.wallMs) * 10) / 10 });
  return { ...take, manifest: { ...m, trigger: anchor, alignment: { actionId, wallMs: anchor.wallMs } }, frames: take.frames.map(rebase), trace: take.trace.map(rebase) };
}
