import {
  Component,
  computed,
  DestroyRef,
  ElementRef,
  HostListener,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { Auth } from '../../core/services/auth';
import { Search } from '../../core/services/search';
import { ThemePreference, ThemeService } from '../../core/services/theme';
import { StorageIndicator } from '../storage-indicator/storage-indicator';
import { ToastHost } from '../toast-host/toast-host';

/** Pages with their own searchable list; searching anywhere else jumps to My Files. */
const SEARCHABLE = ['/my-files', '/starred', '/trash'];

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, StorageIndicator, ToastHost],
  templateUrl: './layout.html',
  styleUrl: './layout.css',
})
export class Layout {
  protected auth = inject(Auth);
  protected theme = inject(ThemeService);
  private router = inject(Router);
  protected searchService = inject(Search);

  private accountRef = viewChild<ElementRef<HTMLElement>>('account');
  private searchRef = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  sidebarOpen = signal(false);
  accountMenuOpen = signal(false);
  private currentUrl = signal(this.router.url);

  initial = computed(() => (this.auth.user()?.username ?? '?').charAt(0).toUpperCase());
  searchPlaceholder = computed(() => {
    const url = this.currentUrl();
    if (url.startsWith('/starred')) return 'Search starred files';
    if (url.startsWith('/trash')) return 'Search trash';
    return 'Search files and folders';
  });

  readonly themeOptions: { value: ThemePreference; label: string; icon: string }[] = [
    { value: 'system', label: 'System', icon: 'computer' },
    { value: 'light', label: 'Light', icon: 'light_mode' },
    { value: 'dark', label: 'Dark', icon: 'dark_mode' },
  ];

  private pendingQuery: string | null = null;

  constructor() {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((event) => {
        const previousSection = this.section(this.currentUrl());
        this.currentUrl.set(event.urlAfterRedirects);
        this.sidebarOpen.set(false);
        this.accountMenuOpen.set(false);

        if (this.pendingQuery !== null) {
          // Search started on a page without a list: carry the query over.
          this.searchService.setQuery(this.pendingQuery);
          this.pendingQuery = null;
          queueMicrotask(() => this.searchRef()?.nativeElement.focus());
        } else if (this.section(event.urlAfterRedirects) !== previousSection) {
          this.searchService.clear();
        }
      });
  }

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (SEARCHABLE.some((path) => this.currentUrl().startsWith(path))) {
      this.searchService.setQuery(value);
    } else if (value.trim()) {
      this.searchService.text.set(value);
      this.pendingQuery = value;
      this.router.navigate(['/my-files']);
    }
  }

  clearSearch(): void {
    this.searchService.clear();
  }

  toggleAccountMenu(): void {
    this.accountMenuOpen.update((open) => !open);
  }

  setTheme(preference: ThemePreference): void {
    this.theme.setPreference(preference);
  }

  signOut(): void {
    this.accountMenuOpen.set(false);
    this.auth.logout();
  }

  /** "/" focuses search, like most file managers. */
  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.accountMenuOpen.set(false);
      this.sidebarOpen.set(false);
    }
    const target = event.target as HTMLElement;
    const typing = target.closest('input, textarea, [contenteditable="true"]');
    if (event.key === '/' && !typing && !event.metaKey && !event.ctrlKey) {
      event.preventDefault();
      this.searchRef()?.nativeElement.focus();
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const account = this.accountRef()?.nativeElement;
    if (account && !account.contains(event.target as Node)) this.accountMenuOpen.set(false);
  }

  private section(url: string): string {
    return url.split(/[?#]/)[0].split('/')[1] ?? '';
  }
}
