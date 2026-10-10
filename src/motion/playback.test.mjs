import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { frameAt, stepTime } from './playback.mjs';
import { buildComparisonPlayer, comparisonPlayer } from './video.mjs';
import { observedEndMs, validateMarkers } from './comparison-player.mjs';

let chromium;
try { ({ chromium } = createRequire(import.meta.url)(process.env.QM_PLAYBACK_PLAYWRIGHT ?? 'playwright')); } catch {}

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a4S8AAAAASUVORK5CYII=', 'base64');
const take = (takeId, times, end = 120) => ({ takeId, manifest: {
  trigger: { wallMs: 123456, event: 'click' }, scenario: { recordBeforeMs: 10, recordAfterMs: end },
  timingSource: 'CDP screencast metadata.timestamp; frames arrive ~9–28ms after the page state they show',
}, frames: times.map((msFromTrigger, i) => ({ msFromTrigger, file: `frames/${i + 1}.jpg` })), trace: [{ msFromTrigger: end }] });
const options = () => ({ before: [take('before-1', [-10, 17.3, 44.8]), take('before-2', [-5, 12, 50])],
  after: [take('after-1', [-8, 22.7, 75], 90)], readFrame: () => png,
  markers: [{ fromMs: 17.3, toMs: 44.8, label: 'Close flash', description: 'Look at the answer panel.' }] });
const model = { frames: [{ ms: -10, src: 'a' }, { ms: 17.3, src: null }, { ms: 44.8, src: 'c' }], endMs: 120 };

test('real irregular timestamps drive stepping and aligned held-frame selection', () => {
  assert.equal(stepTime(model, -10, 1), 17.3);
  assert.equal(stepTime(model, 44.8, -1), 17.3);
  assert.equal(stepTime(model, 17.3, -1), -10);
  assert.equal(stepTime(model, 119, 1), 119);
  assert.equal(frameAt(model, -11).state, 'before first frame');
  assert.equal(frameAt(model, 17.3).state, 'frame unavailable');
  assert.equal(frameAt(model, 44.7).frame.ms, 17.3);
  assert.equal(frameAt(model, 120).frame.ms, 44.8);
  assert.equal(frameAt(model, 120.1).state, 'end of take');
  assert.equal(frameAt({ frames: [], endMs: 120 }, 0).state, 'no frames');
});

test('builder preserves all takes, missing records, capture limits and existing clip downloads', () => {
  const dir = mkdtempSync(join(tmpdir(), 'qm-playback-unit-'));
  try {
    const clip = join(dir, 'before.mp4'); writeFileSync(clip, 'encoded-clip');
    const result = comparisonPlayer({ ...options(), outDir: dir, clips: [{ path: clip, label: 'Before MP4' }],
      readFrame: (t, f) => { if (f.msFromTrigger === 17.3) throw Object.assign(new Error('absent'), { code: 'ENOENT' }); return png; } });
    assert.equal(result.player, join(dir, 'comparison.html'));
    assert.deepEqual(result.takes.before, ['before-1', 'before-2']);
    assert.deepEqual(result.interval, [-10, 120]);
    assert.equal(result.warnings.length, 1);
    assert.match(result.warnings[0], /frame unavailable/);
    const { html } = buildComparisonPlayer({ ...options(), clips: [{ path: clip }] });
    assert.match(html, /data:video\/mp4;base64,ZW5jb2RlZC1jbGlw/);
    assert.match(html, /0.25×/);
    assert.match(html, /Browser refresh may skip images/);
    assert.equal((html.match(/<script>/g) ?? []).length, 1);
    const escaped = buildComparisonPlayer({ ...options(), markers: [{fromMs: 0, toMs: 1, label: '</script><script>bad()', description: 'safe'}] }).html;
    assert.equal((escaped.match(/<script>/g) ?? []).length, 1);
  } finally { rmSync(dir, { recursive: true }); }
});

test('builder rejects unaligned takes, invalid times and unusable intervals', () => {
  const bad = options(); bad.before[0].manifest.trigger.wallMs = null;
  assert.throws(() => buildComparisonPlayer(bad), /recorded trigger/);
  const invalid = options(); invalid.after[0].frames[0].msFromTrigger = null;
  assert.throws(() => buildComparisonPlayer(invalid), /capture timestamp/);
  assert.throws(() => buildComparisonPlayer({ ...options(), interval: { fromMs: 50, toMs: 40 } }), /interval/);
  assert.throws(() => buildComparisonPlayer({ ...options(), markers: [{ fromMs: 0, toMs: 200, label: 'out', description: '' }] }), /marker/);
});

test('partial and rebased recordings end at observed evidence; malformed markers fail early', () => {
  const t = take('partial', [-10, 20], 100);
  t.manifest.scenario.recordAfterMs = 800;
  t.manifest.status = 'partial';
  assert.equal(observedEndMs(t), 100);
  t.manifest.recording = { endedWallMs: 123506 };
  assert.equal(observedEndMs(t), 50);
  const result = buildComparisonPlayer({ ...options(), before: [t] });
  assert.match(result.warnings.join(' '), /partial capture/);
  for (const marker of [null, {}, { fromMs: 0, toMs: 2, label: 'missing description' }])
    assert.throws(() => validateMarkers([marker], { fromMs: -10, toMs: 100 }), /marker 1/);
});

// Set QM_PLAYBACK_PLAYWRIGHT to an installed Playwright module path. This test
// launches only its own local Chromium; no QM service or target is touched.
test('Chromium player interactions preserve the shared clock, markers, take choice and unavailable states',
  { skip: !chromium }, async () => {
    const browser = await chromium.launch({ executablePath: process.env.QM_PLAYBACK_CHROMIUM ?? '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
    const dir = mkdtempSync(join(tmpdir(), 'qm-playback-browser-'));
    try {
      const page = await browser.newPage({ viewport: { width: 720, height: 360 } });
      await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
      await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      const opts = options();
      opts.before.push(take('empty-take', []));
      opts.readFrame = (t, f) => { if (t.takeId === 'before-1' && f.msFromTrigger === 44.8) throw new Error('missing'); return png; };
      const path = comparisonPlayer({ ...opts, outDir: dir }).player;
      await page.goto(pathToFileURL(path).href);
      await page.locator('#before-image').evaluate(img => img.decode());
      await page.getByRole('button', { name: 'Next before frame', exact: true }).click();
      await assert.doesNotReject(() => page.getByText('+17.3 ms from trigger', { exact: true }).waitFor());
      assert.match(await page.locator('#after-time').textContent(), /captured -8.0 ms/);
      await page.getByRole('button', { name: 'Next after frame', exact: true }).click();
      assert.equal(await page.locator('#clock').textContent(), '+22.7 ms from trigger');
      await page.getByRole('button', { name: 'Next before frame', exact: true }).click();
      assert.equal(await page.locator('#before-empty').textContent(), 'frame unavailable');
      assert.equal(await page.locator('#before-image').isVisible(), false);
      await page.locator('#before-take').selectOption('1');
      assert.equal(await page.locator('#clock').textContent(), '+44.8 ms from trigger');
      assert.match(await page.locator('#before-time').textContent(), /captured \+12.0 ms/);
      await page.locator('#before-take').selectOption('2');
      assert.equal(await page.locator('#before-empty').textContent(), 'no frames');
      await page.locator('#markers button').click();
      assert.equal(await page.locator('#clock').textContent(), '+17.3 ms from trigger');
      assert.equal(await page.locator('#where').textContent(), 'Look at the answer panel.');
      assert.equal(await page.locator('#markers button').getAttribute('aria-pressed'), 'true');
      await page.locator('#before-take').selectOption('0');
      await page.locator('#speed').selectOption('0.25');
      await page.getByRole('button', { name: 'Play', exact: true }).click();
      await page.clock.runFor(200);
      await page.getByRole('button', { name: 'Pause', exact: true }).click();
      const paused = Number(await page.locator('#seek').inputValue());
      assert.ok(paused >= 60 && paused <= 69, `200ms at 0.25x should advance about 50ms (${paused})`);
      await page.clock.runFor(200);
      assert.equal(Number(await page.locator('#seek').inputValue()), paused, 'Pause holds the shared clock');
      await page.locator('#seek').evaluate(input => { input.value = 110; input.dispatchEvent(new Event('input')); });
      assert.equal(await page.locator('#after-empty').textContent(), 'end of take');
      assert.equal(await page.locator('#after-image').isVisible(), false);
      assert.equal(await page.locator('#before-image').isVisible(), false); // latest before image is unavailable
      await page.getByRole('button', { name: 'Trigger · 0 ms', exact: true }).click();
      await page.screenshot({ path: '/tmp/qm-playback-browser.png' });
      await page.setViewportSize({ width: 375, height: 360 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.deepEqual(errors, []);
    } finally { await browser.close(); rmSync(dir, { recursive: true }); }
  });
