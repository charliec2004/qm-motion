# Bootstrap owns the browser/daemon base; this small layer ships the current CLI.
FROM qm-motion-sandbox:0.1.12
COPY src/motion/*.mjs /opt/qm-motion/cli/
