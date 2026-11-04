import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { API_BASE } from '../api';
import { Auth } from '../services/auth';

/** Requests whose 401 is an expected answer, not an expired session. */
const SESSION_PROBES = [`${API_BASE}/auth/`, `${API_BASE}/users/me`];

/**
 * The session cookie is attached by the browser and the CSRF header by Angular's
 * built-in XSRF support, so all this needs to do is react to an expired session.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(Auth);
  return next(req).pipe(
    catchError((error: unknown) => {
      const isProbe = SESSION_PROBES.some((url) => req.url.startsWith(url));
      if (error instanceof HttpErrorResponse && error.status === 401 && !isProbe) {
        auth.handleSessionExpired();
      }
      return throwError(() => error);
    }),
  );
};
