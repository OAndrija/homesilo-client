# syntax=docker/dockerfile:1

# ── Build ─────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY . .
RUN npm run build

# ── Runtime: nginx serves the SPA and proxies /api to the server ──────────────
FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist/homesilo-client/browser /usr/share/nginx/html

# Overridden by docker-compose; these defaults suit a single-host setup.
ENV API_UPSTREAM=http://server:8080 \
    MAX_UPLOAD_SIZE=5GB
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/healthz >/dev/null || exit 1
