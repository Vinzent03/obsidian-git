# Installs the NPM dependencies for the execution inside docker container

FROM node:18-slim

WORKDIR /app

COPY *.json esbuild.config.mjs polyfill_buffer.js ./
