# Elite Writer V5 — Production Docker Image
# Multi-stage build: install deps + build → lean runtime

# ── Stage 1: Build ─────────────────────────────────────────
FROM node:22-slim AS builder

RUN corepack enable && corepack prepare pnpm@10.4.1 --activate

WORKDIR /app

# Copy package files first for better layer caching
COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/

# Install all dependencies (including devDependencies for build)
RUN pnpm install --frozen-lockfile 2>/dev/null || pnpm install

# Build-time env vars for Vite (baked into the client bundle at build time)
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

# Copy source code
COPY . .

# Build client (Vite) and server (esbuild)
RUN pnpm run build

# ── Stage 2: Production ───────────────────────────────────
FROM node:22-slim AS runner

RUN corepack enable && corepack prepare pnpm@10.4.1 --activate

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/

# Install only production dependencies
RUN pnpm install --prod --frozen-lockfile 2>/dev/null || pnpm install --prod

# Copy built output from builder
COPY --from=builder /app/dist ./dist

# Copy Drizzle config for migrations
COPY drizzle.config.ts ./
COPY drizzle/ ./drizzle/
# Postgres migration set — applied automatically at boot (server/_core/migrations.ts)
COPY drizzle-pg/ ./drizzle-pg/

# Expose port
ENV PORT=3000
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# Start
CMD ["node", "dist/index.js"]
