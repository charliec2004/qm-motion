#!/usr/bin/env bash
source "$(dirname "$0")/common.sh"
qm status
compose ps -a
python3 scripts/computer.py --status
