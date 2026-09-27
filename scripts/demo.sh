#!/usr/bin/env bash
set -euo pipefail
TASK_ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
cd "$TASK_ROOT"
action=${1:-start}
case "$action" in start|reset|status|stop|check) ;; *) echo 'Usage: npm run demo -- [start|reset|status|stop|check]' >&2; exit 2 ;; esac

# Every operator action goes through the selected QM computer. Never reset a
# user's checkout: each reset installs into a new, retained run directory.
# README.md and check.mjs describe the defect, so they stay out of the agent's
# copy; check brings the probe in only while it runs.
if [[ "$action" == check ]]; then
  python3 scripts/computer.py sh -c 'cat > /root/workspace/qm-motion-demo/current/.readiness-check.mjs' < demo/check.mjs
fi
state=$(python3 scripts/computer.py bash -s -- "$action" <<'REMOTE'
set -euo pipefail
base=/root/workspace/qm-motion-demo
action=$1
pid_file="$base/current/server.pid"
running=false
if [[ -f "$pid_file" ]]; then
  pid=$(cat "$pid_file")
  if [[ "$pid" =~ ^[0-9]+$ ]] && [[ -r "/proc/$pid/cmdline" ]] &&
    tr '\0' '\n' < "/proc/$pid/cmdline" | grep -Fxq "$(readlink -f "$base/current")/server.mjs"; then
    running=true
  fi
fi
if [[ "$action" == status ]]; then
  echo "Operator demo running: $running; workspace: $(readlink -f "$base/current" 2>/dev/null || true)"
elif [[ "$action" == check ]]; then
  if [[ "$running" != true ]]; then echo 'Start the demo first.' >&2; exit 1; fi
  trap 'rm -f "$base/current/.readiness-check.mjs"' EXIT
  node "$base/current/.readiness-check.mjs" /root/demo-readiness
elif [[ "$action" == stop || "$action" == reset ]]; then
  if [[ "$running" == true ]]; then
    kill "$pid"
    for attempt in {1..40}; do
      if ! kill -0 "$pid" 2>/dev/null; then break; fi
      sleep 0.1
    done
  fi
  echo 'Demo process stopped; all working copies retained.'
elif [[ "$running" == true ]]; then
  echo "Demo already running at http://localhost:4173 in $(readlink -f "$base/current")"
elif [[ -e "$base/current" || -L "$base/current" ]]; then
  if [[ ! -f "$base/current/server.mjs" ]]; then
    echo 'The current demo workspace is incomplete; restore it or explicitly use reset for a new copy.' >&2
    exit 1
  fi
  echo resume-required
else
  echo create-required
fi
REMOTE
)
printf '%s\n' "$state"
if [[ "$action" != reset && "$state" != create-required && "$state" != resume-required ]]; then exit 0; fi

new_copy=true
if [[ "$state" == resume-required && "$action" != reset ]]; then
  new_copy=false
  destination=$(python3 scripts/computer.py readlink -f /root/workspace/qm-motion-demo/current)
else
  (cd demo && sha256sum --check --status baseline.sha256)
  run="$(date -u +%Y%m%dT%H%M%SZ)-$$"
  destination="/root/workspace/qm-motion-demo/runs/$run"
  python3 scripts/computer.py mkdir -p "$destination"
  tar -C demo --exclude=node_modules --exclude=README.md --exclude=check.mjs --exclude=public/bundle.js --exclude=public/bundle.css \
    --exclude=public/bundle.js.map --exclude=public/bundle.css.map -cf - . |
    python3 scripts/computer.py tar --no-same-owner -xf - -C "$destination"
fi
python3 scripts/computer.py bash -s -- "$destination" "$new_copy" <<'REMOTE'
set -euo pipefail
destination=$1
new_copy=$2
cd "$destination"
node --input-type=module <<'JS'
import { createServer } from 'node:net';
const probe = createServer();
probe.on('error', error => {
  console.error(`Cannot start the operator demo on port 4173: ${error.code}. Stop any QM background demo job before host start/reset.`);
  process.exit(1);
});
await new Promise(resolve => probe.listen(4173, '0.0.0.0', resolve));
await new Promise(resolve => probe.close(resolve));
JS
if [[ "$new_copy" == true ]]; then
  npm ci --no-audit --no-fund
  git init --quiet
  git add .
  git -c user.name='QM Motion demo' -c user.email='qm-motion@localhost' commit --quiet -m 'Field Notes baseline'
  ln -sfn "$destination" /root/workspace/qm-motion-demo/current
  # Earlier runs may hold a previous fix; retain them outside the agent's workspace.
  mkdir -p /root/qm-motion-demo-archive
  find /root/workspace/qm-motion-demo/runs -mindepth 1 -maxdepth 1 ! -path "$destination" \
    -exec mv -t /root/qm-motion-demo-archive/ {} +
fi
nohup node "$destination/server.mjs" >server.log 2>&1 </dev/null &
echo $! >server.pid
node --input-type=module <<'JS'
let ready = false;
for (let attempt = 0; attempt < 40; attempt++) {
  try {
    const response = await fetch('http://localhost:4173', { signal: AbortSignal.timeout(1000) });
    if (response.ok && (await response.text()).includes('Field Notes')) { ready = true; break; }
  } catch {}
  await new Promise(resolve => setTimeout(resolve, 250));
}
if (!ready) throw new Error('Demo readiness failed; inspect the current run server.log.');
JS
echo "Demo ready: http://localhost:4173 (inside the QM computer)"
echo "Editable workspace: $destination"
REMOTE
