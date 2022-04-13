FROM node:16-alpine

# This doesn't seem needed unless we move files around?
# COPY test/orchestrator/package.json /package.json

RUN cd / && npm ci

# Shouldn't be necessary since we removed the ts-to-js build step.
# COPY dist/orchestrator/index.js /index.js

ENTRYPOINT ["npm", "start"]
