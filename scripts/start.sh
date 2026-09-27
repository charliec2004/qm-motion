#!/usr/bin/env bash
source "$(dirname "$0")/common.sh"
python3 scripts/configure.py
compose up -d
qm check
qm up --build-from runtime
node scripts/enable-model.mjs
python3 scripts/computer.py --connect
python3 -c 'import json; print("QM: " + json.load(open("deployment/qm.config.jsonc"))["publicUrl"] + " — npm run login opens administrator sign-in on this Linux box.")'
