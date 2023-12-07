FROM node:16-alpine

WORKDIR /usr/src/app

ARG NODE_ENV
ENV NODE_ENV $NODE_ENV

COPY package*.json /usr/src/app/
RUN npm install
RUN apk update
RUN apk add
RUN apk add ffmpeg

COPY . /usr/src/app

ENV PORT 3000
EXPOSE $PORT
CMD ["node", "server.js"]

