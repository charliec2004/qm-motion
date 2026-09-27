#!/usr/bin/env bash
set -euo pipefail
TASK_ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
cd "$TASK_ROOT"
action=${1:-status}
case "$action" in install|status) ;; *) echo 'Usage: npm run trailhead -- [install|status]' >&2; exit 2 ;; esac

# The Trailhead storefront is an agent-facing repository: the agent starts its
# dev server itself (QM background tool) and writes the FAQ page. install moves
# every earlier demo copy and motion take out of /root/workspace first, so the
# agent cannot read an earlier diagnosis. Nothing is deleted.
if [[ "$action" == status ]]; then
  python3 scripts/computer.py bash -s <<'REMOTE'
repo=/root/workspace/trailhead-storefront
if [[ -d "$repo/.git" ]]; then git -C "$repo" log --oneline -3; git -C "$repo" status --short; else echo "Not installed: $repo"; fi
curl -s -o /dev/null -w 'localhost:5173 HTTP %{http_code}\n' http://localhost:5173/ || true
REMOTE
  exit 0
fi

tar -C targets/trailhead --exclude=node_modules --exclude=dist -cf - . |
  python3 scripts/computer.py bash -c 'rm -rf /tmp/trailhead-src && mkdir -p /tmp/trailhead-src && tar --no-same-owner -xf - -C /tmp/trailhead-src'
python3 scripts/computer.py bash -s <<'REMOTE'
set -euo pipefail
workspace=/root/workspace
archive="/root/demo-archive/$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$archive/motion"
# Stop dev servers left by earlier runs (bracket keeps pgrep from matching itself).
for pid in $(pgrep -f '[n]ode_modules/.bin/vite' || true); do kill "$pid" 2>/dev/null || true; done
for name in trailhead-storefront trailhead-faq qm-motion-demo; do
  if [[ -e "$workspace/$name" ]]; then mv "$workspace/$name" "$archive/"; fi
done
find "$workspace/artifacts/motion" -mindepth 1 -maxdepth 1 ! -name selftest -exec mv -t "$archive/motion/" {} + 2>/dev/null || true
mv /tmp/trailhead-src "$workspace/trailhead-storefront"
cd "$workspace/trailhead-storefront"
npm ci --no-audit --no-fund --loglevel=error
git init --quiet -b main
git add .
git -c user.name='Trailhead Web Team' -c user.email='web@trailhead.example' commit --quiet -m 'Trailhead storefront 1.4.0'
echo "Earlier copies and takes archived to $archive"
echo "Installed $workspace/trailhead-storefront at $(git rev-parse --short HEAD)"
REMOTE
echo 'GBrain cases are not touched; back them up and soft-delete them separately if needed.'
