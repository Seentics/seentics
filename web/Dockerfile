# Multi-stage build: Next.js static export, served by Caddy (see Caddyfile)
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
WORKDIR /app

# postinstall runs bundle-trackers — needs tracker sources before install
COPY package.json package-lock.json* ./
COPY public/trackers ./public/trackers/
# Install all dependencies first (including dev deps for postinstall)
RUN npm ci --legacy-peer-deps

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
# Uncomment the following line in case you want to disable telemetry during the build.
ENV NEXT_TELEMETRY_DISABLED=1

# Add build-time environment variables
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Bake in enterprise flag at build time (NEXT_PUBLIC_ vars are not injectable at runtime)
ARG NEXT_PUBLIC_IS_ENTERPRISE=false
ENV NEXT_PUBLIC_IS_ENTERPRISE=$NEXT_PUBLIC_IS_ENTERPRISE

ARG NEXT_PUBLIC_SUPPORT_EMAIL=support@seentics.com
ENV NEXT_PUBLIC_SUPPORT_EMAIL=$NEXT_PUBLIC_SUPPORT_EMAIL

# Seentics self-tracking (baked at build time)
ARG NEXT_PUBLIC_SEENTICS_SITE_ID
ENV NEXT_PUBLIC_SEENTICS_SITE_ID=$NEXT_PUBLIC_SEENTICS_SITE_ID
ARG NEXT_PUBLIC_SEENTICS_WEBSITE_ID
ENV NEXT_PUBLIC_SEENTICS_WEBSITE_ID=$NEXT_PUBLIC_SEENTICS_WEBSITE_ID
ARG NEXT_PUBLIC_SEENTICS_TRACKER_URL
ENV NEXT_PUBLIC_SEENTICS_TRACKER_URL=$NEXT_PUBLIC_SEENTICS_TRACKER_URL
ARG NEXT_PUBLIC_SEENTICS_API_HOST
ENV NEXT_PUBLIC_SEENTICS_API_HOST=$NEXT_PUBLIC_SEENTICS_API_HOST

ARG NEXT_PUBLIC_CRISP_WEBSITE_ID
ENV NEXT_PUBLIC_CRISP_WEBSITE_ID=$NEXT_PUBLIC_CRISP_WEBSITE_ID

RUN NODE_OPTIONS="--max_old_space_size=2048" npm run build
RUN node scripts/caddy-shell-rules.cjs public/_redirects shell-rules.caddy

# The export is plain files, so the runtime needs no Node: Caddy serves them and proxies
# /api to the core API.
FROM caddy:2.8.4-alpine AS runner

ARG NEXT_PUBLIC_IS_ENTERPRISE=false
ENV SEENTICS_ENTERPRISE=$NEXT_PUBLIC_IS_ENTERPRISE
# Where /api/* goes; the compose service name by default.
ENV API_UPSTREAM=api:8001

COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=builder /app/shell-rules.caddy /etc/caddy/shell-rules.caddy
COPY --from=builder /app/out /srv

# Validate at build time, so a broken rule fails the image rather than the deploy.
RUN caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile

# Caddy writes its state under /data and /config even with nothing to persist.
RUN chown -R nobody:nobody /data /config
USER nobody
EXPOSE 4000
