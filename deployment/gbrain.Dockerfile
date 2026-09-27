FROM debian:12-slim@sha256:7b140f374b289a7c2befc338f42ebe6441b7ea838a042bbd5acbfca6ec875818
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY .state/bin/gbrain /usr/local/bin/gbrain
ENV GBRAIN_HOME=/data
ENTRYPOINT ["gbrain"]
CMD ["serve", "--http", "--bind", "0.0.0.0", "--port", "3131", "--public-url", "https://gbrain.qm.internal:3443"]
