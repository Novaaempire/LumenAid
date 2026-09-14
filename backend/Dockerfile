# Dev-oriented image: installs deps and runs the watch-mode dev server.
# Not intended as a hardened production image for this MVP stage.
FROM node:20-alpine

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 4000
# db:init is idempotent (CREATE TABLE IF NOT EXISTS), so it's safe to run
# on every container start rather than requiring a separate migration step.
CMD ["sh", "-c", "npm run db:init && npm run dev"]
