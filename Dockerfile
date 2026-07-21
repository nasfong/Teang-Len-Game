# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────────────────────────
# Teang Len web — production image (static Vite SPA served by nginx).
#
# The API base URL is a BUILD-TIME value: Vite inlines import.meta.env.VITE_API_URL
# into the JS bundle, so it must be supplied as a --build-arg and the image is
# specific to one API origin. Rebuild to point at a different backend.
# ─────────────────────────────────────────────────────────────────────────────

# ---- 1. build: produce the static dist/ bundle ----
FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

# Required — fail early with a clear message rather than shipping a bundle that
# points at localhost. e.g. --build-arg VITE_API_URL=https://api.teanglen.com
ARG VITE_API_URL
RUN test -n "$VITE_API_URL" || (echo "ERROR: build-arg VITE_API_URL is required (e.g. https://api.example.com)" >&2 && exit 1)
ENV VITE_API_URL=$VITE_API_URL

# Testing images only: auto-register a throw-away account so the site opens on
# Home with no login step. Leave unset for production — the login screen is then
# the normal entry point. e.g. --build-arg VITE_AUTO_GUEST=true
ARG VITE_AUTO_GUEST
ARG VITE_AUTO_GUEST_PREFIX
ENV VITE_AUTO_GUEST=$VITE_AUTO_GUEST
ENV VITE_AUTO_GUEST_PREFIX=$VITE_AUTO_GUEST_PREFIX

RUN npm run build

# ---- 2. runtime: nginx serving the static files ----
FROM nginx:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
# nginx:alpine already runs `nginx -g "daemon off;"` as its default CMD.
