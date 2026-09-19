FROM oven/bun:1.2-debian

WORKDIR /app

# System libraries required by Playwright's managed Chromium
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    wget \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libvulkan1 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

COPY package.json bun.lock ./
# A locked install makes the image reproducible. `bun add` in a Docker build used
# to mutate the dependency graph independently of the committed lockfile.
RUN bun install --frozen-lockfile
# Explicitly download Playwright's Chromium (bun doesn't run post-install scripts).
RUN ./node_modules/.bin/playwright install chromium
# Keep the runtime browser path outside `/root` because the production API process
# runs as `seentics`; drop the root-owned copy to avoid carrying it twice.
RUN mkdir -p /ms-playwright \
    && cp -a /root/.cache/ms-playwright/. /ms-playwright/ \
    && rm -rf /root/.cache/ms-playwright
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

COPY . .

# The API listens on an unprivileged port and has no reason to run as root.
RUN groupadd --system --gid 10001 seentics \
    && useradd --system --uid 10001 --gid seentics --create-home seentics \
    && chown -R seentics:seentics /app /ms-playwright
USER seentics

EXPOSE 8001
ENV PORT=8001

CMD ["bun", "run", "index.ts"]
