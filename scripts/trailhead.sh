#!/usr/bin/env bash
set -euo pipefail
TASK_ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
cd "$TASK_ROOT"
action=${1:-status}
case "$action" in install|status|scan|probe) ;; *) echo 'Usage: npm run trailhead -- [install|status|scan|probe [url]]' >&2; exit 2 ;; esac
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

# Operator check after the build prompt: does the agent's FAQ show the close rebound?
# Records closing the open question 3 times from outside the workspace, prints the
# answer height at the end of each close, then deletes the takes so the agent never sees them.
if [[ "$action" == probe ]]; then
  python3 scripts/computer.py bash -s -- "${2:-http://localhost:5173/faq}" <<'REMOTE'
set -euo pipefail
url=$1
scenario=/root/probe-close.json
cleanup() { rm -rf /root/workspace/artifacts/motion/*-opprobe-* "$scenario"; }
trap cleanup EXIT
target=$(node -e '
const { chromium } = require("/opt/qm-motion/node_modules/playwright");
(async () => {
  const b = await chromium.launch({ executablePath: "/usr/bin/chromium" });
  const p = await b.newPage();
  await p.goto(process.argv[1]); await p.waitForTimeout(600);
  const id = await p.locator("button[aria-expanded=true][aria-controls]").first().getAttribute("aria-controls", { timeout: 5000 });
  console.log(id); await b.close();
})().catch(e => { console.error(`no open accordion question at ${process.argv[1]}: ${e.message.split("\n")[0]}`); process.exit(1); });' "$url")
cat > "$scenario" <<J
{"name":"operator-probe","url":"$url","viewport":{"width":960,"height":720},"ready":{"selector":"[aria-controls=\"$target\"]","settleMs":400},
"trigger":{"action":"click","selector":"[aria-controls=\"$target\"]"},
"watch":[{"name":"answer","selector":"[id=\"$target\"]"}],"recordBeforeMs":100,"recordAfterMs":700}
J
cd /root/workspace
node motion/cli.mjs capture --scenario "$scenario" --label opprobe --takes 3 > /tmp/opprobe.json 2>/dev/null || { cat /tmp/opprobe.json; rm -f /tmp/opprobe.json; exit 1; }
rm -f /tmp/opprobe.json
for t in $(ls artifacts/motion | grep -- '-opprobe-'); do
  node -e '
const trace = require(`/root/workspace/artifacts/motion/${process.argv[1]}/trace.json`);
const pts = trace.filter(s => s.msFromTrigger >= 0).map(s => ({ ms: s.msFromTrigger, h: s.elements.answer?.hidden || !s.elements.answer ? null : s.elements.answer.height }));
let min = Infinity, rebound = null;
for (const p of pts) { if (p.h === null) break; if (p.h < min) min = p.h; else if (p.h - min > 5 && !rebound) rebound = { ...p, from: min }; }
const tail = pts.filter(p => p.ms > 200 && p.ms < 360).map(p => `${p.ms.toFixed(0)}ms:${p.h === null ? "hidden" : p.h.toFixed(1)}`).join("  ");
const measured = pts.some(p => p.h !== null);
console.log(!measured ? "INCONCLUSIVE (answer not measured)" : rebound ? `REBOUND at +${rebound.ms.toFixed(0)} ms (${rebound.from.toFixed(1)} -> ${rebound.h.toFixed(1)} px)` : "no rebound", "|", tail);' "$t"
done
REMOTE
  exit $?
fi

# 1. Everything an earlier run could leave, except QM's own workspace files, the
#    motion CLI, environment-smoke evidence and live background jobs.
list=$(python3 scripts/computer.py bash -s <<'REMOTE'
# Stop the previous run's background jobs (dev servers, previews) so their logs can be archived.
for d in /root/.agent-proc/*/; do
  pid=$(cat "$d/pid" 2>/dev/null || true)
  [[ "$pid" =~ ^[0-9]+$ ]] || continue
  pkill -P "$pid" 2>/dev/null || true
  kill "$pid" 2>/dev/null || true
done
for pid in $(pgrep -f '[n]ode_modules/.bin/vite' || true); do kill "$pid" 2>/dev/null || true; done
# Wait (up to 5 s) for those jobs to exit so their logs are archived below.
for attempt in {1..10}; do
  alive=0
  for d in /root/.agent-proc/*/; do pid=$(cat "$d/pid" 2>/dev/null || true); [[ "$pid" =~ ^[0-9]+$ ]] && kill -0 "$pid" 2>/dev/null && alive=1; done
  [[ $alive == 0 ]] && break
  sleep 0.5
done
keep='.agent-turn apis.json artifacts browser-smoke.mjs conversations.json convos deployments.json files.json loops.json motion projects.json qm-computer-proof.txt qm-ui-proof.txt skills'
for p in /root/workspace/* /root/workspace/.[!.]*; do
  [[ -e "$p" ]] || continue
  [[ " $keep " == *" $(basename "$p") "* ]] || echo "${p#/}"
done
for p in /root/workspace/artifacts/motion/*; do [[ -e "$p" && "$(basename "$p")" != selftest ]] && echo "${p#/}"; done
for p in /root/*-archive /root/.npm/_logs; do [[ -e "$p" ]] && echo "${p#/}"; done
# agent-browser session files the agent created (the environment smoke's own session stays).
for p in /root/.agent-browser/*; do
  [[ -e "$p" ]] || continue
  case "$(basename "$p")" in qm-environment-smoke.*) ;; *) echo "${p#/}" ;; esac
done
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
