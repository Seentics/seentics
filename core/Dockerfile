FROM oven/bun:1.2-alpine

WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install && bun add openai

COPY . .

EXPOSE 3002
ENV PORT=3002

CMD ["bun", "run", "index.ts"]
