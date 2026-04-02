# ---------------------------------------------------------------------------
# Stage 1: Install dependencies
# ---------------------------------------------------------------------------
FROM oven/bun:1 AS deps

WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# ---------------------------------------------------------------------------
# Stage 2: Build admin SPA
# ---------------------------------------------------------------------------
FROM deps AS build

COPY . .
RUN bun run build:admin

# ---------------------------------------------------------------------------
# Stage 3: Production image
# ---------------------------------------------------------------------------
FROM oven/bun:1-slim AS production

WORKDIR /app

# Copy dependency manifests and install production-only deps
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile --production && \
    rm -rf /root/.bun/install/cache

# Copy source code (Bun runs TS directly, no compile step needed)
COPY src/ ./src/
COPY drizzle.config.ts ./
COPY migrations/ ./migrations/

# Copy built admin SPA from build stage
COPY --from=build /app/dist/admin ./dist/admin

# Copy entrypoint
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

ENTRYPOINT ["./entrypoint.sh"]
