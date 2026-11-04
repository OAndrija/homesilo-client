/**
 * All API calls are same-origin: in development `ng serve` proxies `/api` to the
 * Spring Boot server (proxy.conf.json), in production the bundled nginx does.
 * Same-origin is what lets the session live in an HttpOnly cookie.
 */
export const API_BASE = '/api/v1';
