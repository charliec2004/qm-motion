// Target-specific readiness check, not the QM Motion capture implementation.
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = createRequire('/opt/qm-motion/package.json')('playwright')); }
const source = fileURLToPath(new URL('.', import.meta.url));
const output = resolve(process.argv[2] ?? '/tmp/qm-motion-demo-check');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 720 }, reducedMotion: 'no-preference' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const report = {
    startedAt: new Date().toISOString(), browser: await browser.version(),
    viewport: { width: 960, height: 720 }, url: 'http://localhost:4173',
    initialState: 'Fresh navigation; first question open; wait 350ms; click first trigger once.',
    appSource: {}, runs: [],
    caveat: 'requestAnimationFrame geometry samples can perturb rendering; they establish a layout rebound, not visual smoothness or frame delivery to a model.',
  };
  for (const name of ['src/main.jsx', 'src/style.css', 'package.json', 'package-lock.json']) {
    report.appSource[name] = createHash('sha256').update(await readFile(resolve(source, name))).digest('hex');
  }
  for (let run = 0; run < 3; run++) {
    await page.goto(report.url);
    await page.getByRole('button', { name: 'What comes with a Field Notes membership?' }).waitFor();
    await page.waitForTimeout(350);
    const samples = await page.evaluate(() => new Promise(resolve => {
      const trigger = document.querySelector('.trigger');
      const content = document.querySelector('.content');
      const next = document.querySelectorAll('.header')[1];
      const triggerAt = performance.now();
      const frames = [];
      const sample = () => {
        const elapsedMs = performance.now() - triggerAt;
        frames.push({ elapsedMs, height: content.getBoundingClientRect().height, nextY: next.getBoundingClientRect().y, hidden: content.hidden });
        if (elapsedMs < 700) requestAnimationFrame(sample);
        else resolve({ triggerAt, timeOrigin: performance.timeOrigin, frames });
      };
      trigger.click();
      requestAnimationFrame(sample);
    }));
    samples.rebounds = samples.frames.filter((frame, index, frames) => index > 0 && frame.height > frames[index - 1].height + 1);
    report.runs.push(samples);
  }
  await page.screenshot({ path: resolve(output, 'settled.png') });
  report.errors = errors;
  await writeFile(resolve(output, 'geometry.json'), JSON.stringify(report, null, 2));
  if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
  console.log(`Target loaded in Chromium ${report.browser}. Closing layout rebounds: ${report.runs.map(run => run.rebounds.length).join(', ')}. Evidence: ${output}`);
} finally { await browser.close(); }
