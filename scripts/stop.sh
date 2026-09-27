#!/usr/bin/env bash
source "$(dirname "$0")/common.sh"
python3 scripts/computer.py --stop
# The upstream `qm down` also removes labeled agent containers, losing their
# extra client-network attachment. Retain stopped project containers instead.
mapfile -t services < <(docker ps -q --filter label=qm.org=qm-motion)
if ((${#services[@]})); then docker stop "${services[@]}"; fi
compose stop
echo 'Stopped QM Motion; database and workspace volumes retained.'
