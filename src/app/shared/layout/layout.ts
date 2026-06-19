import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Auth } from '../../core/services/auth';

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './layout.html',
  styleUrl: './layout.css',
})
export class Layout {
  private auth = inject(Auth);
  private router = inject(Router);

  username = signal(this.auth.getTokenPayload()?.sub ?? '');
  sidebarOpen = signal(true);

  ngOnInit(): void {
    if (window.innerWidth < 768) {
      this.sidebarOpen.set(false);
    }
  }

  toggleSidebar(): void {
    this.sidebarOpen.update((v) => !v);
  }

  closeOnMobile(): void {
    if (window.innerWidth < 768) {
      this.sidebarOpen.set(false);
    }
  }

  onLogout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
