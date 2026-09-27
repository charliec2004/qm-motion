#!/usr/bin/env bash
set -euo pipefail
TASK_ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
cd "$TASK_ROOT"
compose() { docker compose --env-file "$TASK_ROOT/.env" -f "$TASK_ROOT/deployment/compose.yaml" "$@"; }
qm() { (cd "$TASK_ROOT/deployment" && npm exec -- qm "$@"); }
