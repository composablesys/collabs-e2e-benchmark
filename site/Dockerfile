FROM node:16-stretch-slim

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

EXPOSE 8080

# Specify the framework (npm run argument) in the FRAMEWORK environment variable.
ENTRYPOINT ["npm", "start"]