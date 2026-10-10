FROM ghcr.io/yc-software/qm/web-ui@sha256:746ca51bb2dcb4d9d7295d57bfe7b4868c8aecb30f30bafc80fc9573e358be99

USER root
COPY interim-attachments/apply-web-ui.mjs /tmp/qm-motion-apply-web-ui.mjs
RUN node /tmp/qm-motion-apply-web-ui.mjs /app && rm /tmp/qm-motion-apply-web-ui.mjs
USER node
