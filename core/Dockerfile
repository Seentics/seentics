# Production image. No browser: heatmaps are drawn on the DOM snapshot the tracker
# captures, and a screenshot is only the fallback background — rendered on
# Cloudflare Browser Rendering when CLOUDFLARE_SCREENSHOTS_ENABLED is set, and
# otherwise skipped (HEATMAP_LOCAL_SCREENSHOTS=false below). Shipping Chromium made
# this image 3.9 GB and put a browser's memory inside analytics' budget.
FROM oven/bun:1.2-alpine AS deps
WORKDIR /app
COPY package.json bun.lock ./
# A locked install makes the image reproducible. Bun runs no postinstall scripts,
# so @playwright/browser-chromium downloads nothing here.
RUN bun install --frozen-lockfile

FROM oven/bun:1.2-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HEATMAP_LOCAL_SCREENSHOTS=false
# The API listens on an unprivileged port and has no reason to run as root.
RUN addgroup -S -g 10001 seentics && adduser -S -u 10001 -G seentics seentics
COPY --from=deps --chown=seentics:seentics /app/node_modules ./node_modules
COPY --chown=seentics:seentics . .
USER seentics

EXPOSE 8001
ENV PORT=8001

CMD ["bun", "run", "index.ts"]
