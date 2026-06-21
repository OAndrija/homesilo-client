import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet, NavigationEnd } from '@angular/router';
import { Auth } from '../../core/services/auth';
import { StorageIndicator } from '../storage-indicator/storage-indicator';
import { Search } from '../../core/services/search';
import { filter } from 'rxjs';
import { ThemeService } from '../../core/services/theme';

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, StorageIndicator],
  templateUrl: './layout.html',
  styleUrl: './layout.css',
})
export class Layout {
  private auth = inject(Auth);
  private router = inject(Router);
  private searchService = inject(Search);
  themeService = inject(ThemeService);

  sidebarOpen = signal(true);
  searchInputValue = signal('');
  isHome = signal(false);

  constructor() {
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.searchInputValue.set('');
        this.searchService.clear();
        this.isHome.set(event.urlAfterRedirects.startsWith('/home'));
      });
  }

  ngOnInit(): void {
    if (window.innerWidth < 768) {
      this.sidebarOpen.set(false);
    }
  }

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchInputValue.set(value);
    this.searchService.setQuery(value);
  }

  onClearSearch(): void {
    this.searchInputValue.set('');
    this.searchService.clear();
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
