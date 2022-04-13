FROM node:12.0.0-stretch-slim

RUN apt update \
    && apt upgrade -y \
    && apt install -y chromium iproute2 --no-install-recommends \
    && rm -rf /var/lib/apt/lists/* \
    && rm -rf /src/*.deb

RUN cd / && yarn add puppeteer-core

COPY test/browser/index.js /index.js

ENTRYPOINT ["node", "/index.js"]
