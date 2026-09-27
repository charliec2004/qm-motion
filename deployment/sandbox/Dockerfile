ARG BASE
FROM ${BASE}
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium ffmpeg fonts-liberation fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json /opt/qm-motion/
RUN cd /opt/qm-motion && npm ci --omit=dev \
    && ln -s /opt/qm-motion/node_modules/.bin/agent-browser /usr/local/bin/agent-browser
COPY .state/build/agent.mjs /opt/qm/agent.mjs
COPY .state/bin/gbrain /usr/local/bin/gbrain
COPY .state/tls/localhost.crt /usr/local/share/ca-certificates/qm-motion.crt
RUN update-ca-certificates
ENV NODE_EXTRA_CA_CERTS=/usr/local/share/ca-certificates/qm-motion.crt
ENV HOME=/root AGENT_BROWSER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PATH="/opt/qm-motion/node_modules/.bin:${PATH}"
WORKDIR /root
EXPOSE 8080
CMD ["node", "/opt/qm/agent.mjs"]
