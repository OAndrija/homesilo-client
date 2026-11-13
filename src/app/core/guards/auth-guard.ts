import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth } from '../services/auth';
import { catchError, map, of } from 'rxjs';

/** Only signed-in users; others go to the login page and come back afterwards. */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(Auth);
  if (auth.isLoggedIn()) return true;
  return inject(Router).createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

/** Only signed-out users (login / register); signed-in users go straight to the app. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  return auth.isLoggedIn() ? inject(Router).createUrlTree(['/home']) : true;
};

/** Only admins; everyone else is sent to the dashboard. */
export const adminGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  return auth.isAdmin() ? true : inject(Router).createUrlTree(['/home']);
};

/** Sign-in and sign-up pages: a server nobody has set up yet goes to setup first. */
export const setupDoneGuard: CanActivateFn = () => {
  const router = inject(Router);
  return inject(Auth)
    .config()
    .pipe(
      map((config) => (config.setupRequired ? router.createUrlTree(['/setup']) : true)),
      catchError(() => of(true)), // server unreachable: the page will say so
    );
};

/** The setup page: only while there is no account yet. */
export const setupNeededGuard: CanActivateFn = () => {
  const router = inject(Router);
  return inject(Auth)
    .config()
    .pipe(
      map((config) => (config.setupRequired ? true : router.createUrlTree(['/login']))),
      catchError(() => of(router.createUrlTree(['/login']))),
    );
};
