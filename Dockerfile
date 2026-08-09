# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────────────────────────
# Teang Len web — production image (static Vite SPA served by nginx).
#
# Config is resolved at RUN time, not build time: entrypoint.sh writes /config.js from
# the container's environment on every start and the app reads it (src/services/config.js).
# So one image serves every environment — `docker run -e API_URL=... `.
#
# The VITE_* build args below are still honoured as the baked-in DEFAULT, used when a
# container is started without the matching env var.
# ─────────────────────────────────────────────────────────────────────────────

# ---- 1. build: produce the static dist/ bundle ----
FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

# Optional fallbacks, baked into the bundle. A container that sets API_URL overrides
# them; leaving them unset ships an image that REQUIRES the runtime env var.
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# Testing images only: auto-register a throw-away account so the site opens on
# Home with no login step. Leave unset for production — the login screen is then
# the normal entry point.
ARG VITE_AUTO_GUEST
ARG VITE_AUTO_GUEST_PREFIX
ENV VITE_AUTO_GUEST=$VITE_AUTO_GUEST
ENV VITE_AUTO_GUEST_PREFIX=$VITE_AUTO_GUEST_PREFIX

# Debug x-ray — deliberately NOT a build arg. It is runtime-only (-e DEBUG_PEEK=true)
# so it can never be baked into an image: an image is shared and long-lived, and this
# flag shows every player every hand.

RUN npm run build

# ---- 2. runtime: nginx serving the static files ----
FROM nginx:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
EXPOSE 80

# Regenerates /config.js from the environment, then execs nginx's own entrypoint.
# CMD must be restated: overriding ENTRYPOINT does not inherit the base image's.
ENTRYPOINT ["/entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
