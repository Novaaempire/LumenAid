# Dev-oriented image: installs deps and runs the Vite dev server bound to
# all interfaces so it's reachable from outside the container.
FROM node:20-alpine

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
