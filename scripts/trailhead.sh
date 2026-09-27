#!/usr/bin/env bash
set -euo pipefail
TASK_ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
cd "$TASK_ROOT"
action=${1:-status}
case "$action" in install|status|scan) ;; *) echo 'Usage: npm run trailhead -- [install|status|scan]' >&2; exit 2 ;; esac
if [[ ! -d node_modules/playwright || ! -f deployment/.env ]]; then
  echo "Run this from the primary checkout (it needs node_modules and deployment/.env); $TASK_ROOT has neither." >&2
  exit 2
fi

# The Trailhead storefront is an agent-facing repository: the agent starts its
# dev server itself (QM background tool) and writes the FAQ page. install primes
# a clean rehearsal: QM's per-user memory is reset and old sessions archived,
# every earlier run's files leave the agent computer for an ignored host
# archive, a fresh copy is installed, and a leak scan must pass.

# Words that only earlier investigations would leave behind.
LEAK_PATTERN='rebound|reopen|grid-template-rows|radix-accordion-content-height|slideUp|accordion-up|trailhead-faq|field notes|flicker'

scan() {
  local status=0
  python3 scripts/computer.py bash -s -- "$LEAK_PATTERN" <<'REMOTE' || status=1
pattern=$1
hits=$(grep -rIl -i -E "$pattern" /root /tmp --exclude-dir=node_modules --exclude-dir=_cacache \
  --exclude-dir=agent-creds 2>/dev/null | grep -v -E '^/root/workspace/(motion|trailhead-storefront)/|^/root/workspace/apis\.json$' || true)
pages=$(gbrain list 2>&1 || true)
status=0
if [[ -n "$hits" ]]; then echo "Leak scan: files mention earlier runs:"; echo "$hits"; status=1; else echo 'Leak scan: no earlier-run files in the agent computer.'; fi
if [[ "$pages" != *'No pages found'* ]]; then echo "GBrain is not empty (back up and soft-delete before a clean run):"; echo "$pages"; status=1; else echo 'GBrain: no pages.'; fi
exit $status
REMOTE
  node scripts/prime-qm.mjs --check || status=1
  return $status
}

if [[ "$action" == status ]]; then
  python3 scripts/computer.py bash -s <<'REMOTE'
repo=/root/workspace/trailhead-storefront
if [[ -d "$repo/.git" ]]; then git -C "$repo" log --oneline -3; git -C "$repo" status --short; else echo "Not installed: $repo"; fi
curl -s -o /dev/null -w 'localhost:5173 HTTP %{http_code}\n' http://localhost:5173/ || true
REMOTE
  exit 0
fi
if [[ "$action" == scan ]]; then scan && exit 0 || exit 1; fi

# 1. Everything an earlier run could leave, except QM's own workspace files, the
#    motion CLI, environment-smoke evidence and live background jobs.
list=$(python3 scripts/computer.py bash -s <<'REMOTE'
for pid in $(pgrep -f '[n]ode_modules/.bin/vite' || true); do kill "$pid" 2>/dev/null || true; done
keep='.agent-turn apis.json artifacts browser-smoke.mjs conversations.json convos deployments.json files.json loops.json motion projects.json qm-computer-proof.txt qm-ui-proof.txt skills'
for p in /root/workspace/* /root/workspace/.[!.]*; do
  [[ -e "$p" ]] || continue
  [[ " $keep " == *" $(basename "$p") "* ]] || echo "${p#/}"
done
for p in /root/workspace/artifacts/motion/*; do [[ -e "$p" && "$(basename "$p")" != selftest ]] && echo "${p#/}"; done
for p in /root/*-archive /root/.npm/_logs; do [[ -e "$p" ]] && echo "${p#/}"; done
for d in /root/.agent-proc/*/; do
  [[ -d "$d" ]] || continue
  pid=$(cat "$d/pid" 2>/dev/null || true)
  if [[ -z "$pid" ]] || ! kill -0 "$pid" 2>/dev/null; then echo "${d#/}"; fi
done
for p in /tmp/* /tmp/.[!.]*; do
  [[ -e "$p" ]] || continue
  case "$(basename "$p")" in agent-creds|keychain*|.exec-*|org.chromium.*|node-compile-cache|.X*|.ICE*) ;; *) echo "${p#/}" ;; esac
done
REMOTE
)
out="artifacts/rehearsal-archive/$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$out"
node scripts/prime-qm.mjs "$out"
if [[ -n "$list" ]]; then
  printf '%s\n' "$list" > "$out/paths.txt"
  cid=$(python3 scripts/computer.py --name)
  docker exec -i "$cid" tar -C / -czf - -T - < "$out/paths.txt" > "$out/archive.tgz"
  tar -tzf "$out/archive.tgz" > /dev/null
  docker exec -i -w / "$cid" bash -c 'while read -r p; do [[ -n "$p" ]] && rm -rf -- "/$p"; done' < "$out/paths.txt"
  echo "Moved $(wc -l < "$out/paths.txt") earlier-run paths to $out/archive.tgz"
fi

# 2. A fresh storefront copy with one Git commit.
tar -C targets/trailhead --exclude=node_modules --exclude=dist -cf - . |
  python3 scripts/computer.py bash -c 'rm -rf /tmp/trailhead-src && mkdir -p /tmp/trailhead-src && tar --no-same-owner -xf - -C /tmp/trailhead-src'
python3 scripts/computer.py bash -s <<'REMOTE'
set -euo pipefail
mv /tmp/trailhead-src /root/workspace/trailhead-storefront
cd /root/workspace/trailhead-storefront
npm ci --no-audit --no-fund --loglevel=error
rm -rf /root/.npm/_logs
git init --quiet -b main
git add .
git -c user.name='Trailhead Web Team' -c user.email='web@trailhead.example' commit --quiet -m 'Trailhead storefront 1.4.0'
echo "Installed /root/workspace/trailhead-storefront at $(git rev-parse --short HEAD)"
REMOTE

# 3. The run is clean only if nothing from earlier runs remains.
scan
