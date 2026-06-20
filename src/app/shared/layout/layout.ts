import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet, NavigationEnd } from '@angular/router';
import { Auth } from '../../core/services/auth';
import { StorageIndicator } from '../storage-indicator/storage-indicator';
import { Search } from '../../core/services/search';
import { filter } from 'rxjs';

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

  sidebarOpen = signal(true);
  searchInputValue = signal('');

  constructor() {
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(() => {
        this.searchInputValue.set('');
        this.searchService.clear();
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
