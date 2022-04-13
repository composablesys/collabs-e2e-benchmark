FROM node:16-stretch-slim

RUN cd / && npm ci && npm run build

# Specify the framework (npm run argument) in the FRAMEWORK environment variable.
ENTRYPOINT ["npm", "start"]
