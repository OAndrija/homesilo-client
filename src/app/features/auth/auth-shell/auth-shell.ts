import { Component, inject, input } from '@angular/core';
import { ThemeService } from '../../../core/services/theme';

/**
 * Shared frame for the sign-in and register pages: the brand panel with the
 * HomeSilo illustration on the left, and the page's form projected on the right.
 */
@Component({
  selector: 'app-auth-shell',
  templateUrl: './auth-shell.html',
  styleUrl: './auth-shell.css',
})
export class AuthShell {
  protected themeService = inject(ThemeService);

  /** Brand-panel headline; each entry is one line. */
  headline = input.required<string[]>();
  lead = input.required<string>();

  readonly points = [
    { icon: 'home', text: 'Runs on your own server, so your files never leave home' },
    {
      icon: 'folder_managed',
      text: 'Folders, stars, search and previews, like the clouds you know',
    },
    { icon: 'restore_from_trash', text: 'Deleted something by mistake? Restore it from the trash' },
  ];
}
