# OpenShell receives the container command. This image only supplies challenge code.
FROM node:22.19.0-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates iproute2 nftables util-linux \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd sandbox \
    && useradd -m -d /sandbox -g sandbox -s /bin/sh sandbox \
    && ln -s /usr/local/bin/node /usr/bin/node

WORKDIR /opt/openrind-ctf
COPY openrind-desktop/packages/ctf-runtime/package.json ./
COPY openrind-desktop/packages/ctf-runtime/src/ ./src/
COPY openrind-desktop/packages/ctf-runtime/bin/challenge.mjs ./bin/challenge.mjs
RUN node --check bin/challenge.mjs && chown -R sandbox:sandbox /opt/openrind-ctf /sandbox

USER sandbox
WORKDIR /sandbox
CMD ["sleep", "infinity"]
