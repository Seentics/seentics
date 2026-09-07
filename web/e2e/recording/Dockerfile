FROM oven/bun:1.2-alpine AS core
WORKDIR /app
COPY core/package.json core/bun.lock* ./
RUN bun install --frozen-lockfile
COPY core/ ./
CMD ["bun", "run", "index.ts"]

FROM node:20-alpine AS web
WORKDIR /app
COPY web/package*.json ./
COPY web/public/trackers/ ./public/trackers/
RUN npm ci --legacy-peer-deps
COPY web/ ./
CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0"]
