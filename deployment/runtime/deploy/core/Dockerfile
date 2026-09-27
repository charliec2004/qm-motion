FROM ghcr.io/yc-software/qm/core@sha256:8859f0debbd5c6de2166c64bde18797c48ae638dd320de5861c0a5e36ddaff64
USER root
COPY patches/ /tmp/qm-motion-patches/
RUN cd /app && for patch in /tmp/qm-motion-patches/*.patch; do \
      git apply --check "$patch" && git apply "$patch" || exit 1; \
    done && rm -r /tmp/qm-motion-patches
USER node
