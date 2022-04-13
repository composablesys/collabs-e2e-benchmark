FROM node:12.0.0-alpine

COPY test/orchestrator/package.json /package.json

RUN cd / && yarn install

COPY dist/orchestrator/index.js /index.js

ENTRYPOINT ["node", "/index.js", "/config.json"]
