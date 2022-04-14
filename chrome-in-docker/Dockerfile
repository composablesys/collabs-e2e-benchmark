FROM node:16-stretch-slim

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

# # Nothing to build this time.
# RUN npm run build

ENTRYPOINT ["node", "/index.js"]
