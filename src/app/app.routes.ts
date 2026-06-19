import { Routes } from '@angular/router';
import { Login } from './features/auth/login/login';
import { Register } from './features/auth/register/register';
import { authGuard } from './core/guards/auth-guard';
import { Layout } from './shared/layout/layout';
import { MyFiles } from './features/my-files/my-files';
import { Trash } from './features/trash/trash';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  {
    path: 'login',
    component: Login,
  },
  {
    path: 'register',
    component: Register,
  },
  {
    path: '',
    canActivate: [authGuard],
    component: Layout,
    children: [
      { path: 'my-files', component: MyFiles},
      { path: 'trash', component: Trash },
    ],
  },
];
