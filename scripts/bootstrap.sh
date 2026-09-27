#!/usr/bin/env bash
source "$(dirname "$0")/common.sh"
umask 077
mkdir -p .state/bin .state/build .state/tls artifacts/smoke
npm ci
npm ci --prefix deployment
python3 scripts/setup-env.py
if [[ ! -s .state/tls/localhost.crt ]]; then
  openssl req -x509 -newkey rsa:2048 -noenc -days 365 \
    -keyout .state/tls/localhost.key -out .state/tls/localhost.crt \
    -subj '/CN=QM Motion local development' \
    -addext 'subjectAltName=DNS:localhost,DNS:gbrain.qm.internal,IP:127.0.0.1' 2>artifacts/tls-generation.log
fi
if [[ ! -x .state/bin/gbrain ]]; then
  curl -fsSL https://github.com/garrytan/gbrain/releases/download/v0.59.0.0/gbrain-linux-x64 -o .state/bin/gbrain
  chmod 755 .state/bin/gbrain
fi
echo '68db99e632e575ea2c83eb03c741acf418351d19f3d26c855c04762f627fbd14  .state/bin/gbrain' | sha256sum --check --status
cp deployment/node_modules/@yc-software/qm/templates/aws/microvm-agent/agent.mjs .state/build/agent.mjs
docker build --build-arg BASE=ghcr.io/yc-software/qm/sandbox-base@sha256:9c632c8359eb41a626880b4669328c8fbe2fe7e7d38b99e5cc37fd389c2d04ab \
  -f deployment/sandbox/Dockerfile -t qm-motion-sandbox:0.1.12 .
compose build gbrain
compose up -d brain-db tls
if ! compose run --rm --entrypoint test gbrain -s /data/.gbrain/config.json; then
  compose run --rm gbrain init --non-interactive --no-embedding --db-only >artifacts/gbrain-init.log 2>&1
fi
compose up -d gbrain
python3 scripts/provision-gbrain.py
qm check
echo 'Bootstrap complete. Add OPENAI_API_KEY to deployment/.env if needed, then npm start.'
