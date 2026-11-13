import { Routes } from '@angular/router';
import {
  adminGuard,
  authGuard,
  guestGuard,
  setupDoneGuard,
  setupNeededGuard,
} from './core/guards/auth-guard';
import { Layout } from './shared/layout/layout';

export const routes: Routes = [
  {
    path: 'setup',
    canActivate: [guestGuard, setupNeededGuard],
    title: 'Set up HomeSilo',
    loadComponent: () => import('./features/auth/setup/setup').then((m) => m.Setup),
  },
  {
    path: 'login',
    canActivate: [guestGuard, setupDoneGuard],
    title: 'Sign in · HomeSilo',
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
  },
  {
    path: 'register',
    canActivate: [guestGuard, setupDoneGuard],
    title: 'Create account · HomeSilo',
    loadComponent: () => import('./features/auth/register/register').then((m) => m.Register),
  },
  {
    // The link's secret is in the fragment (/invite#…), which the server never sees.
    path: 'invite',
    canActivate: [guestGuard, setupDoneGuard],
    title: "You're invited · HomeSilo",
    data: { invite: true },
    loadComponent: () => import('./features/auth/register/register').then((m) => m.Register),
  },
  {
    path: '',
    canActivate: [authGuard],
    component: Layout,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'home' },
      {
        path: 'home',
        title: 'Dashboard · HomeSilo',
        loadComponent: () => import('./features/home/home').then((m) => m.Home),
      },
      {
        path: 'my-files',
        title: 'My Files · HomeSilo',
        loadComponent: () => import('./features/my-files/my-files').then((m) => m.MyFiles),
      },
      {
        path: 'starred',
        title: 'Starred · HomeSilo',
        loadComponent: () => import('./features/starred/starred').then((m) => m.Starred),
      },
      {
        path: 'trash',
        title: 'Trash · HomeSilo',
        loadComponent: () => import('./features/trash/trash').then((m) => m.Trash),
      },
      {
        path: 'admin/users',
        canActivate: [adminGuard],
        title: 'Users · HomeSilo',
        loadComponent: () => import('./features/admin/admin-users').then((m) => m.AdminUsers),
      },
      {
        path: 'admin/activity',
        canActivate: [adminGuard],
        title: 'Activity · HomeSilo',
        loadComponent: () =>
          import('./features/admin/activity/admin-activity').then((m) => m.AdminActivity),
      },
      {
        path: 'settings',
        title: 'Settings · HomeSilo',
        loadComponent: () => import('./features/settings/settings').then((m) => m.Settings),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
