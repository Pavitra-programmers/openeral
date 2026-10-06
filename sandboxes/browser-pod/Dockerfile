# Stage 0 browser sandbox. Build a child image; do not rebuild NVIDIA images.
FROM node:22.19.0-bookworm-slim
ARG CHROMIUM_VERSION
RUN test -n "$CHROMIUM_VERSION" \
    && apt-get update \
    && apt-get install -y --no-install-recommends "chromium=$CHROMIUM_VERSION" ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd sandbox \
    && useradd -m -d /sandbox -g sandbox -s /bin/bash sandbox \
    && ln -s /usr/local/bin/node /usr/bin/node
COPY agent.mjs launch.mjs /opt/openrind-browser-pod/
RUN node --check /opt/openrind-browser-pod/agent.mjs \
    && node --check /opt/openrind-browser-pod/launch.mjs \
    && /usr/lib/chromium/chromium --version
USER sandbox
WORKDIR /sandbox
CMD ["sleep", "infinity"]
