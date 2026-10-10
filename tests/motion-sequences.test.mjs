import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadScenario, normalizeSequence, alignTake } from '../src/motion/scenario.mjs';

const click = { action: 'click', selector: '#toggle' };
test('legacy trigger normalizes and sequences reject ambiguous timing and anchors', () => {
  assert.deepEqual(normalizeSequence({ trigger: click }).actions, [{ ...click, id: 'trigger', atMs: 0 }]);
  for (const scenario of [
    { actions: [] }, { actions: [{ ...click, atMs: 1 }] },
    { actions: [{ ...click, atMs: 0 }, { ...click, atMs: -1 }] },
    { actions: [{ ...click, atMs: 0, id: 'same' }, { ...click, atMs: 1, id: 'same' }] },
    { actions: [{ ...click, atMs: 0 }], alignAction: 'missing' },
    { actions: [{ ...click, atMs: '0' }] }, { actions: [{ ...click, atMs: Infinity }] },
    { actions: [{ ...click, atMs: 0 }], trigger: click },
  ]) assert.throws(() => normalizeSequence(scenario));
});
test('full recorded window is bounded, including the sequence', () => {
  const dir = mkdtempSync(join(tmpdir(), 'motion-schema-'));
  try {
    const file = join(dir, 'scenario.json');
    writeFileSync(file, JSON.stringify({ name: 'bounded', url: 'http://localhost:5173/', actions: [{ ...click, atMs: 0 }, { ...click, atMs: 9500 }] }));
    assert.throws(() => loadScenario(file), /10000/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test('alignment uses observed wall time and preserves the original take', () => {
  const take = { takeId: 'test', manifest: { scenario: {}, trigger: { wallMs: 100 }, actions: [{ id: 'reopen', event: { wallMs: 220 } }] }, frames: [{ wallMs: 230, msFromTrigger: 130 }], trace: [{ wallMs: 210, msFromTrigger: 110 }] };
  const rebased = alignTake(take, 'reopen');
  assert.equal(rebased.frames[0].msFromTrigger, 10);
  assert.equal(rebased.trace[0].msFromTrigger, -10);
  assert.equal(take.frames[0].msFromTrigger, 130);
  assert.throws(() => alignTake(take, 'missing'), /no observed event/);
});
