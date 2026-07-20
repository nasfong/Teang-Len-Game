# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────────────────────────
# Teang Len API — production image (Express + Socket.IO relay server).
# Multi-stage: compile TS → install prod-only deps → copy both into a slim runtime.
# Build context is the `backend/` directory (see Makefile / -f backend/Dockerfile).
# ─────────────────────────────────────────────────────────────────────────────

# ---- 1. build: compile TypeScript to dist/ (needs devDependencies for tsc) ----
FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- 2. deps: production-only node_modules (no tsc/tsx/@types) ----
FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---- 3. runtime: slim image with only what's needed to run ----
FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV PORT=4000
WORKDIR /app

# Copy prod deps + compiled output; package.json is kept for metadata / "type".
COPY --from=deps  /app/node_modules ./node_modules
COPY --from=build /app/dist         ./dist
COPY package.json ./

# Drop root — the base image ships an unprivileged `node` user.
USER node

EXPOSE 4000

# Liveness against the /health route the server exposes (spec §5). Uses the http
# module (not global fetch) to stay warning-free on Node 20.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||4000)+'/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

# Env (PORT, CLIENT_ORIGIN, AUTH_SECRET) is injected by the orchestrator at run
# time — never bake .env into the image. AUTH_SECRET MUST be set in production.
CMD ["node", "dist/index.js"]
