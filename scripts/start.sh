#!/usr/bin/env bash
source "$(dirname "$0")/common.sh"
python3 scripts/configure.py
compose up -d
qm check
qm up --build-from runtime
node scripts/enable-model.mjs
python3 scripts/computer.py --connect
echo 'QM: https://localhost:8443 — npm run login opens administrator sign-in.'
