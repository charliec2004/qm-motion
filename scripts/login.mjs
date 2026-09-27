import { execFileSync, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { X509Certificate, createHash } from 'node:crypto';

// The credential-bearing link goes directly to the local browser, never stdout.
const url = execFileSync('./node_modules/.bin/qm', ['admin-login'], {
  cwd: new URL('../deployment/', import.meta.url), encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'],
}).trim();
const cert = new X509Certificate(readFileSync(new URL('../.state/tls/localhost.crt', import.meta.url)));
const spki = createHash('sha256').update(cert.publicKey.export({type: 'spki', format: 'der'})).digest('base64');
const browserEnv = { ...process.env };
// An agent shell may lack the existing desktop session's display variables.
// Read only that session's graphical settings; never print its environment.
if (!browserEnv.DISPLAY && !browserEnv.WAYLAND_DISPLAY) {
  try {
    const wanted = new Set(['DISPLAY', 'WAYLAND_DISPLAY', 'XDG_RUNTIME_DIR', 'XDG_SESSION_TYPE', 'DBUS_SESSION_BUS_ADDRESS']);
    const session = execFileSync('systemctl', ['--user', 'show-environment'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    for (const line of session.split('\n')) {
      const separator = line.indexOf('=');
      const key = line.slice(0, separator);
      if (wanted.has(key)) browserEnv[key] = line.slice(separator + 1);
    }
  } catch { /* A normal graphical terminal already supplies these values. */ }
}
if (!browserEnv.DISPLAY && !browserEnv.WAYLAND_DISPLAY)
  throw new Error('Run npm run login from this machine’s graphical desktop terminal.');
const child = spawn('chromium', [
  '--user-data-dir=' + new URL('../.state/login-browser', import.meta.url).pathname,
  '--ignore-certificate-errors-spki-list=' + spki,
  url,
], { detached: true, stdio: 'ignore', env: browserEnv });
await new Promise((resolve, reject) => {
  child.once('error', reject);
  child.once('spawn', resolve);
});
const earlyExit = await Promise.race([
  new Promise(resolve => child.once('exit', code => resolve(code))),
  new Promise(resolve => setTimeout(() => resolve(null), 500)),
]);
if (earlyExit !== null && earlyExit !== 0)
  throw new Error(`Chromium exited with code ${earlyExit}; run login from the graphical desktop.`);
child.unref();
console.log('Opened QM administrator sign-in in a dedicated local Chromium profile. Confirm your email.');
