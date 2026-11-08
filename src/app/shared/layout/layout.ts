import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink, RouterLinkActive, RouterOutlet, NavigationEnd } from '@angular/router';
import { StorageIndicator } from '../storage-indicator/storage-indicator';
import { Search } from '../../core/services/search';
import { filter } from 'rxjs';
import { AccountMenu } from '../account-menu/account-menu';

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, StorageIndicator, AccountMenu],
  templateUrl: './layout.html',
  styleUrl: './layout.css',
})
export class Layout implements OnInit {
  private router = inject(Router);
  private searchService = inject(Search);

  sidebarOpen = signal(true);
  searchInputValue = signal('');
  isHome = signal(false);

  constructor() {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((event) => {
        this.searchInputValue.set('');
        this.searchService.clear();
        // File search has nothing to search on the dashboard or in settings.
        const url = event.urlAfterRedirects;
        this.isHome.set(url.startsWith('/home') || url.startsWith('/settings'));
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
}
