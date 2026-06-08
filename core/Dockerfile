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

COPY package.json bun.lock* ./
RUN bun install && bun add openai
# Explicitly download Playwright's Chromium (bun doesn't run post-install scripts)
RUN ./node_modules/.bin/playwright install chromium

COPY . .

EXPOSE 3002
ENV PORT=3002

CMD ["bun", "run", "index.ts"]
