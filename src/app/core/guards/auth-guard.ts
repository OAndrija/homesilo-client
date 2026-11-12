import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth } from '../services/auth';

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
