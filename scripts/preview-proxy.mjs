import http from 'node:http';
import net from 'node:net';
import { execFileSync } from 'node:child_process';

// Forwards 127.0.0.1:15173 on this host to the agent computer's dev server (port 5173), so
// Tailscale Serve can publish it to the tailnet. Vite accepts only known hosts, so the Host
// and Origin headers are rewritten to localhost; WebSocket upgrades (Vite HMR) pass through.
const LISTEN = Number(process.env.PREVIEW_PORT ?? 15173);
const TARGET = 5173;
const local = `localhost:${TARGET}`;
let address = null;

function computerAddress() {
  if (address) return address;
  const name = execFileSync('python3', ['scripts/computer.py', '--name'], { encoding: 'utf8' }).trim();
  const ips = execFileSync('docker', ['inspect', name, '--format', '{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}'],
    { encoding: 'utf8' }).trim().split(/\s+/).filter(Boolean);
  if (!ips.length) throw new Error(`agent computer ${name} has no network address; is it running?`);
  return (address = ips[0]);
}

const rewrite = headers => ({ ...headers, host: local, ...(headers.origin ? { origin: `http://${local}` } : {}) });

function unavailable(res, error) {
  address = null;
  res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' });
  res.end(`No dev server on port ${TARGET} in the agent computer (${error.code ?? error.message}).\n` +
    'Ask the agent to start it (it keeps it running with its background tool), then reload.\n');
}

const server = http.createServer((req, res) => {
  let host;
  try { host = computerAddress(); } catch (e) { return unavailable(res, e); }
  const upstream = http.request({ host, port: TARGET, method: req.method, path: req.url, headers: rewrite(req.headers) }, up => {
    res.writeHead(up.statusCode, up.headers);
    up.pipe(res);
  });
  upstream.on('error', e => (res.headersSent ? res.destroy() : unavailable(res, e)));
  req.pipe(upstream);
});

server.on('upgrade', (req, socket, head) => {
  let host;
  try { host = computerAddress(); } catch { return socket.destroy(); }
  const upstream = net.connect(TARGET, host, () => {
    const lines = [`${req.method} ${req.url} HTTP/${req.httpVersion}`];
    for (const [k, v] of Object.entries(rewrite(req.headers))) for (const x of [].concat(v)) lines.push(`${k}: ${x}`);
    upstream.write(`${lines.join('\r\n')}\r\n\r\n`);
    if (head?.length) upstream.write(head);
    upstream.pipe(socket);
    socket.pipe(upstream);
  });
  upstream.on('error', () => { address = null; socket.destroy(); });
  socket.on('error', () => upstream.destroy());
});

server.listen(LISTEN, '127.0.0.1', () => console.log(`preview proxy: http://127.0.0.1:${LISTEN} -> agent computer :${TARGET}`));
