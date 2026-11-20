# HomeSilo web app

The browser side of [HomeSilo](https://github.com/OAndrija/homesilo-server), a
file storage service you run at home. To install HomeSilo, follow the
[install guide](https://github.com/OAndrija/homesilo-server/blob/main/docs/install.md)
in the server repository. It uses the published images, so you don't need
anything from this repository.

This is the place for working on the interface itself. It's an Angular 22 app
built from standalone components and signals, with no zone.js, strict
TypeScript and lazy-loaded pages. In production, nginx serves it and passes
`/api` through to the server.

## Working on it

You need Node 22 and a server on `localhost:8080`. The quickest way to get one
is `./mvnw spring-boot:test-run` in `homesilo-server`, which brings its own
throwaway database.

```sh
npm ci
npm start        # http://localhost:4200
```

The dev server forwards `/api` to `localhost:8080` (see `proxy.conf.json`), so
the browser only ever talks to one origin. That's what lets the session live in
an HttpOnly cookie that scripts can't read, with CSRF protection on top. There's
no token in `localStorage`.

```sh
npm run test:ci       # unit tests (Vitest)
npm run build         # production build in dist/homesilo-client/browser
npm run format        # Prettier
```

The browser tests for the whole stack live in the server repository, under
`e2e/`. When CI runs them for a branch, it uses the branch of the same name
here if there is one.

## Layout

```
src/app
├── core/       models, API services, interceptor, guards, small helpers
├── features/   one folder per page: auth, home, my-files, starred, trash,
│               settings, admin
└── shared/     the app shell, file list, preview, dialogs, pipes
```

Uploads over 32 MB are sent in pieces through the server's upload sessions
(`core/services/chunked-uploads.ts`). A failed piece is retried a few times
with a growing pause, and **Retry** in the upload panel carries on from the
last piece the server has.

Fonts and icons are bundled rather than loaded from Google, so the app works on
a home network with no internet access.

## The container

The `Dockerfile` builds the app and serves it with unprivileged nginx. nginx
also forwards `/api` to the server, streaming bodies both ways so big uploads
and downloads aren't buffered, with long timeouts for slow connections. It adds
gzip, long caching for the hashed files, and a strict Content-Security-Policy.

| Variable | Default | What it does |
|---|---|---|
| `API_UPSTREAM` | `http://server:8080` | Where `/api` goes |
| `MAX_UPLOAD_SIZE` | `5GB` | The largest request nginx accepts. Keep it the same as the server's |
| `TRUSTED_PROXIES` | none | Only when another proxy sits in front (Cloudflare Tunnel, Caddy): its address or range, comma-separated. Without it, the server sees that proxy's address for every visitor and sign-in limits stop working properly |
| `REAL_IP_HEADER` | `X-Forwarded-For` | The header that proxy puts the visitor's address in. `CF-Connecting-IP` for Cloudflare |

When nginx is the first thing a request hits, which is the default, anything a
visitor puts in `X-Forwarded-For` is ignored. Otherwise anyone could pretend to
be a different address on every sign-in attempt.

## Releases

The web app and the server are released together, with the same version
number. See [RELEASING.md](https://github.com/OAndrija/homesilo-server/blob/main/RELEASING.md)
in the server repository. Bugs and ideas go to the
[server's issues](https://github.com/OAndrija/homesilo-server/issues) too, so
everything is in one place.
