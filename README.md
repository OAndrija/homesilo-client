# HomeSilo — client

The web UI for [HomeSilo](https://github.com/OAndrija/homesilo-server), a self-hosted
personal cloud. Angular 22: standalone components, signals, zoneless change detection,
lazy-loaded routes, strict TypeScript and strict templates.

## Development

```bash
npm ci
npm start          # http://localhost:4200, /api is proxied to http://localhost:8080
```

The dev server proxies `/api` to the Spring Boot server (`proxy.conf.json`), so the
app and API share one origin. That's what lets the session stay in an HttpOnly cookie
with CSRF protection; there is no token in `localStorage`.

```bash
npm run test:ci    # Vitest unit tests
npm run build      # production build → dist/homesilo-client/browser
npm run format     # Prettier
```

## Production

The `Dockerfile` builds the app and serves it with unprivileged nginx, which also
reverse-proxies `/api` to the server with request/response streaming (no upload
buffering), long timeouts for big transfers, gzip, immutable caching for hashed
assets, and a strict Content-Security-Policy. Fonts and icons are bundled, so the UI
works fully offline on a home network.

The easiest way to run everything is the Compose file in the server repository
(`docker compose up -d --build` from `homesilo-server`, with this repo checked out
next to it). The image reads two environment variables:

| Variable | Default | Purpose |
|---|---|---|
| `API_UPSTREAM` | `http://server:8080` | Where nginx forwards `/api` |
| `MAX_UPLOAD_SIZE` | `5GB` | nginx `client_max_body_size`; keep in line with the server |

## Structure

```
src/app
├── core/         api base, models, services (HTTP + state), interceptor, guards, utils
├── features/     routed pages: auth, home, my-files, starred, trash, settings
└── shared/       layout shell, file table, dialogs, selection bar, pipes
```
