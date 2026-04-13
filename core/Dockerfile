FROM oven/bun:1.2-alpine

WORKDIR /app

COPY package.json ./
RUN bun install

COPY . .

EXPOSE 3002
ENV PORT=3002

CMD ["bun", "run", "index.ts"]
