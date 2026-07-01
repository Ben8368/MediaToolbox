# syntax=docker/dockerfile:1

# ---- Stage 1: build the SPA ----------------------------------------------
# Pinned to the major Node version declared in frontend/package.json engines.
FROM node:22-alpine AS build

WORKDIR /app/frontend

# Install deps first so this layer caches unless the lockfile changes.
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

# Build the production bundle.
#
# The app talks to the backend over a SAME-ORIGIN /api path, so the base URL is
# intentionally left empty: nginx reverse-proxies /api at runtime (see
# nginx.conf.template + BACKEND_URL). This keeps a single image reusable across
# every environment instead of baking an environment-specific host into the JS.
ENV VITE_API_BASE_URL=
COPY frontend/ ./
RUN npm run build

# ---- Stage 2: serve static files -----------------------------------------
FROM nginx:1.27-alpine AS runtime

# Default backend target; override at `docker run` with -e BACKEND_URL=...
# The trailing context is resolved by envsubst into nginx.conf at startup.
ENV BACKEND_URL=http://127.0.0.1:8080
ENV PORT=80

# nginx config is a template: the entrypoint substitutes ${BACKEND_URL} / ${PORT}
# into the real config before nginx starts, so the proxy target is a RUNTIME
# value, not a build-time constant.
COPY deploy/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/frontend/dist /usr/share/nginx/html

EXPOSE 80

# The stock nginx image already runs `envsubst` over /etc/nginx/templates/*.template
# into /etc/nginx/conf.d/ via its docker-entrypoint, then launches nginx.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:${PORT}/ || exit 1

STOPSIGNAL SIGQUIT
