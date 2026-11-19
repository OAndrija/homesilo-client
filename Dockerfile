# syntax=docker/dockerfile:1

# ── Build ─────────────────────────────────────────────────────────────────────
# Runs on the machine doing the build, whatever the target: the built files are the same
# everywhere, and building under arm64 emulation would be slow.
FROM --platform=$BUILDPLATFORM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY . .
RUN npm run build

# ── Runtime: nginx serves the SPA and proxies /api to the server ──────────────
# The image moved from nginxinc/ to nginx/; the old name gets no new releases.
FROM nginx/nginx-unprivileged:1.30.7-alpine
# Alpine security fixes published since the base image was built (Dependabot bumps the tag itself).
USER root
RUN apk upgrade --no-cache
USER 101
COPY --chmod=755 nginx/15-upload-size.envsh /docker-entrypoint.d/15-upload-size.envsh
COPY --chmod=755 nginx/20-real-ip.envsh /docker-entrypoint.d/20-real-ip.envsh
COPY nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist/homesilo-client/browser /usr/share/nginx/html

# Overridden by docker-compose; these defaults suit a single-host setup.
ENV API_UPSTREAM=http://server:8080 \
    MAX_UPLOAD_SIZE=5GB
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/healthz >/dev/null || exit 1
