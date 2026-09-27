#!/usr/bin/env bash
set -euo pipefail
TASK_ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
cd "$TASK_ROOT"
action=${1:-status}
case "$action" in start|stop|status) ;; *) echo 'Usage: npm run preview -- [start|stop|status]' >&2; exit 2 ;; esac

# Live view of the agent computer's dev server (port 5173) for people on the tailnet.
# The proxy runs on this host at 127.0.0.1:15173; Tailscale Serve publishes it once with:
#   sudo tailscale serve --bg --https=8443 http://127.0.0.1:15173
pid_file=.state/preview-proxy.pid
url="https://$(tailscale status --json 2>/dev/null | python3 -c 'import json,sys; print(json.load(sys.stdin)["Self"]["DNSName"].rstrip("."))' 2>/dev/null || echo '<tailnet-host>'):8443/"
running() { [[ -f "$pid_file" ]] && kill -0 "$(cat "$pid_file")" 2>/dev/null; }

if [[ "$action" == stop ]]; then
  if running; then kill "$(cat "$pid_file")"; fi
  rm -f "$pid_file"
  echo 'Preview proxy stopped (the Tailscale Serve route stays configured).'
  exit 0
fi
if [[ "$action" == start ]] && ! running; then
  mkdir -p .state artifacts
  setsid nohup node scripts/preview-proxy.mjs >> artifacts/preview-proxy.log 2>&1 < /dev/null &
  echo $! > "$pid_file"
  sleep 0.5
  running || { echo 'Preview proxy failed to start; see artifacts/preview-proxy.log' >&2; exit 1; }
fi
if running; then echo "Preview proxy: running (pid $(cat "$pid_file")), 127.0.0.1:15173 -> agent computer :5173"; else echo 'Preview proxy: stopped (npm run preview -- start)'; fi
echo "Dev server: $(curl -s -o /dev/null -w 'HTTP %{http_code}' -m 3 http://127.0.0.1:15173/ 2>/dev/null || echo 'no answer')"
if tailscale serve status 2>/dev/null | grep -q ':8443'; then
  echo "Tailnet URL: $url"
else
  echo 'Tailscale route missing; run once: sudo tailscale serve --bg --https=8443 http://127.0.0.1:15173'
fi
