#!/usr/bin/env bash
source "$(dirname "$0")/common.sh"
umask 077
mkdir -p artifacts/smoke/browser
qm check
qm conformance --static
node scripts/smoke-agent.mjs command
python3 scripts/connect-gbrain.py >artifacts/smoke/gbrain-whoami.json
computer=$(python3 scripts/computer.py --name)
docker cp scripts/browser-smoke.mjs "$computer:/root/workspace/browser-smoke.mjs"
python3 scripts/computer.py node /root/workspace/browser-smoke.mjs
docker cp "$computer:/root/workspace/artifacts/environment-smoke/." artifacts/smoke/browser/
node scripts/smoke-agent.mjs vision-memory
compose stop gbrain brain-db
compose up -d gbrain
node scripts/smoke-agent.mjs retrieve
echo 'Environment checks passed. Incoming-image vision is verified; automatic motion tool image delivery is still an MVP task.'
