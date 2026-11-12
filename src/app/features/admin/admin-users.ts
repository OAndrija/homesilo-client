import { DatePipe, DecimalPipe } from '@angular/common';
import {
  Component,
  computed,
  DestroyRef,
  ElementRef,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, Observable, of, switchMap, tap } from 'rxjs';
import { errorMessage } from '../../core/http/http-error';
import {
  AccountStatus,
  AdminOverview,
  AdminUser,
  NewUser,
  UserChanges,
} from '../../core/models/admin';
import { UserRole } from '../../core/models/auth.models';
import { AdminApi } from '../../core/services/admin';
import { Auth } from '../../core/services/auth';
import { Router } from '@angular/router';
import { ToastService } from '../../core/services/toast';
import { formatBytes } from '../../core/utils/format';
import { formatLimit } from '../../core/utils/storage-size';
import { ExactDatePipe, FriendlyDatePipe } from '../../shared/pipes/friendly-date';
import { LoadingDelayPipe } from '../../shared/pipes/loading-delay';
import { DeleteUserDialog } from './delete-user-dialog';
import { PasswordDialog } from './password-dialog';
import { UserFormDialog } from './user-form-dialog';

export type UserSortKey = 'username' | 'role' | 'enabled' | 'lastLoginAt' | 'createdAt';

interface UserSort {
  key: UserSortKey;
  direction: 'asc' | 'desc';
}

const SORT_STORAGE_KEY = 'hs-sort-admin-users';
const PAGE_SIZE = 25;
/** Colours for the people using the most storage, then everyone else. */
const SEGMENT_COLORS = [
  'var(--cat-documents)',
  'var(--cat-images)',
  'var(--cat-archives)',
  'var(--cat-videos)',
  'var(--cat-audio)',
];

@Component({
  selector: 'app-admin-users',
  imports: [
    DatePipe,
    DecimalPipe,
    ExactDatePipe,
    FriendlyDatePipe,
    LoadingDelayPipe,
    UserFormDialog,
    PasswordDialog,
    DeleteUserDialog,
  ],
  templateUrl: './admin-users.html',
  styleUrl: './admin-users.css',
})
export class AdminUsers {
  private api = inject(AdminApi);
  private auth = inject(Auth);
  private toast = inject(ToastService);
  private router = inject(Router);
  private host: ElementRef<HTMLElement> = inject(ElementRef);

  readonly pageSize = PAGE_SIZE;
  formatBytes = formatBytes;
  formatLimit = formatLimit;

  me = this.auth.user;
  overview = signal<AdminOverview | null>(null);

  // ── List state ───────────────────────────────────────────────
  users = signal<AdminUser[]>([]);
  total = signal(0);
  page = signal(0);
  loading = signal(true);
  listError = signal('');

  queryInput = signal('');
  private query = signal('');
  role = signal<UserRole | null>(null);
  status = signal<AccountStatus | null>(null);
  sort = signal<UserSort>(loadSort());
  private reloadTick = signal(0);

  hasFilters = computed(() => !!this.query() || !!this.role() || !!this.status());
  firstShown = computed(() => (this.total() === 0 ? 0 : this.page() * PAGE_SIZE + 1));
  lastShown = computed(() => Math.min(this.total(), (this.page() + 1) * PAGE_SIZE));
  hasPrevious = computed(() => this.page() > 0);
  hasNext = computed(() => this.lastShown() < this.total());

  // ── Overview ─────────────────────────────────────────────────
  /** Who is using the stored space: the biggest accounts, then everyone else, to scale. */
  segments = computed(() => {
    const overview = this.overview();
    if (!overview || overview.storageUsedBytes <= 0) return [];
    const total = overview.storageUsedBytes;
    const top = overview.topUsers.filter((u) => u.bytes > 0);
    const rest = total - top.reduce((sum, u) => sum + u.bytes, 0);
    const parts = top.map((u, i) => ({
      label: u.username,
      bytes: u.bytes,
      color: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
      isMe: u.id === this.me()?.id,
    }));
    if (rest > 0)
      parts.push({ label: 'Everyone else', bytes: rest, color: 'var(--cat-other)', isMe: false });
    return parts.map((p) => ({ ...p, percent: (p.bytes / total) * 100 }));
  });

  disabledCount = computed(() => {
    const overview = this.overview();
    return overview ? overview.users - overview.activeUsers : 0;
  });

  // ── Dialogs and menus ────────────────────────────────────────
  openMenuId = signal<string | null>(null);
  formDialog = signal<{ mode: 'add' } | { mode: 'edit'; user: AdminUser } | null>(null);
  passwordTarget = signal<AdminUser | null>(null);
  deleteTarget = signal<AdminUser | null>(null);
  dialogBusy = signal(false);
  dialogError = signal('');

  private queryTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    const request = computed(() => ({
      filters: { query: this.query(), role: this.role(), status: this.status() },
      sort: this.sort(),
      page: this.page(),
      tick: this.reloadTick(),
    }));

    toObservable(request)
      .pipe(
        tap(() => this.loading.set(true)),
        switchMap(({ filters, sort, page }) =>
          this.api.listUsers(filters, page, PAGE_SIZE, `${sort.key},${sort.direction}`).pipe(
            catchError((err) => {
              this.listError.set(errorMessage(err, 'Couldn’t load the users.'));
              return of(null);
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((response) => {
        this.loading.set(false);
        if (!response) return;
        this.listError.set('');
        this.users.set(response.content);
        this.total.set(response.totalElements);
      });

    this.loadOverview();
    inject(DestroyRef).onDestroy(() => clearTimeout(this.queryTimer));
  }

  // ── Filters, sorting, paging ─────────────────────────────────

  onQueryInput(value: string): void {
    this.queryInput.set(value);
    clearTimeout(this.queryTimer);
    this.queryTimer = setTimeout(() => {
      this.page.set(0);
      this.query.set(value.trim());
    }, 250);
  }

  setRole(value: string): void {
    this.page.set(0);
    this.role.set(value === 'ADMIN' || value === 'USER' ? value : null);
  }

  setStatus(value: string): void {
    this.page.set(0);
    this.status.set(value === 'ACTIVE' || value === 'DISABLED' ? value : null);
  }

  clearFilters(): void {
    clearTimeout(this.queryTimer);
    this.queryInput.set('');
    this.query.set('');
    this.role.set(null);
    this.status.set(null);
    this.page.set(0);
  }

  onSort(key: UserSortKey): void {
    const current = this.sort();
    // Dates start newest-first; text columns start A–Z.
    const firstDirection = key === 'lastLoginAt' || key === 'createdAt' ? 'desc' : 'asc';
    const next: UserSort =
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: firstDirection };
    this.sort.set(next);
    this.page.set(0);
    try {
      localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable: the sort just isn't remembered */
    }
  }

  ariaSort(key: UserSortKey): 'ascending' | 'descending' | null {
    const current = this.sort();
    if (current.key !== key) return null;
    return current.direction === 'asc' ? 'ascending' : 'descending';
  }

  sortArrow(key: UserSortKey): string {
    const current = this.sort();
    return current.key === key && current.direction === 'asc' ? 'arrow_upward' : 'arrow_downward';
  }

  previousPage(): void {
    if (this.hasPrevious()) this.page.update((p) => p - 1);
  }

  nextPage(): void {
    if (this.hasNext()) this.page.update((p) => p + 1);
  }

  // ── Row helpers ──────────────────────────────────────────────

  isMe(user: AdminUser): boolean {
    return user.id === this.me()?.id;
  }

  initial(user: AdminUser): string {
    return user.username.charAt(0).toUpperCase();
  }

  usedPercent(user: AdminUser): number {
    if (user.storageQuotaBytes <= 0) return user.storageUsedBytes > 0 ? 100 : 0;
    return Math.min(100, (user.storageUsedBytes / user.storageQuotaBytes) * 100);
  }

  /** Amber from 80 % full, red from 95 %, like the storage card on the dashboard. */
  usageLevel(user: AdminUser): 'ok' | 'warn' | 'full' {
    const percent = this.usedPercent(user);
    return percent >= 95 ? 'full' : percent >= 80 ? 'warn' : 'ok';
  }

  // ── Row menu ─────────────────────────────────────────────────

  toggleMenu(user: AdminUser, event: MouseEvent): void {
    event.stopPropagation();
    const opening = this.openMenuId() !== user.id;
    this.openMenuId.set(opening ? user.id : null);
    if (opening) {
      // Focus the first item so the menu works from the keyboard.
      setTimeout(() =>
        this.host.nativeElement
          .querySelector<HTMLElement>(`[data-menu="${user.id}"] [role="menuitem"]:not([disabled])`)
          ?.focus(),
      );
    }
  }

  closeMenu(returnFocusTo?: string): void {
    this.openMenuId.set(null);
    if (returnFocusTo) {
      this.host.nativeElement
        .querySelector<HTMLElement>(`[data-menu-trigger="${returnFocusTo}"]`)
        ?.focus();
    }
  }

  onMenuKeydown(event: KeyboardEvent, user: AdminUser): void {
    const items = Array.from(
      (event.currentTarget as HTMLElement).querySelectorAll<HTMLElement>(
        '[role="menuitem"]:not([disabled])',
      ),
    );
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      items[(index + step + items.length) % items.length]?.focus();
    } else if (event.key === 'Escape') {
      event.stopPropagation();
      this.closeMenu(user.id);
    } else if (event.key === 'Tab') {
      this.closeMenu();
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!(event.target as Element).closest?.('.row-menu')) this.openMenuId.set(null);
  }

  // ── Actions ──────────────────────────────────────────────────

  openAdd(): void {
    this.dialogError.set('');
    this.formDialog.set({ mode: 'add' });
  }

  openEdit(user: AdminUser): void {
    this.closeMenu();
    this.dialogError.set('');
    this.formDialog.set({ mode: 'edit', user });
  }

  viewActivity(user: AdminUser): void {
    this.closeMenu();
    this.router.navigate(['/admin/activity'], {
      queryParams: { userId: user.id, name: user.username },
    });
  }

  openPassword(user: AdminUser): void {
    this.closeMenu();
    this.dialogError.set('');
    this.passwordTarget.set(user);
  }

  openDelete(user: AdminUser): void {
    this.closeMenu();
    this.dialogError.set('');
    this.deleteTarget.set(user);
  }

  closeDialogs(): void {
    if (this.dialogBusy()) return;
    this.formDialog.set(null);
    this.passwordTarget.set(null);
    this.deleteTarget.set(null);
  }

  createUser(user: NewUser): void {
    this.runDialog(this.api.createUser(user), (created) => {
      this.toast.success(`Added ${created.username}`);
      this.refresh();
    });
  }

  saveUser(id: string, changes: UserChanges): void {
    this.runDialog(this.api.updateUser(id, changes), (updated) => {
      this.replace(updated);
      this.toast.success(`Saved changes to ${updated.username}`);
      this.loadOverview();
    });
  }

  setPassword(user: AdminUser, password: string): void {
    this.runDialog(this.api.resetPassword(user.id, password), () =>
      this.toast.success(`New password set for ${user.username}. They’ve been signed out.`),
    );
  }

  deleteUser(user: AdminUser): void {
    this.runDialog(this.api.deleteUser(user.id), () => {
      this.toast.success(`Deleted ${user.username} and their files`);
      if (this.users().length === 1 && this.page() > 0) this.page.update((p) => p - 1);
      this.refresh();
    });
  }

  /** Disabling is easy to undo, so it happens straight away with an Undo in the toast. */
  setEnabled(user: AdminUser, enabled: boolean): void {
    this.closeMenu();
    this.api.updateUser(user.id, { enabled }).subscribe({
      next: (updated) => {
        this.replace(updated);
        this.loadOverview();
        if (enabled) {
          this.toast.success(`${updated.username} can sign in again`);
        } else {
          this.toast.success(`Disabled ${updated.username}. They’ve been signed out.`, {
            label: 'Undo',
            run: () => this.setEnabled(updated, true),
          });
        }
      },
      error: (err) => this.toast.error(errorMessage(err, 'Couldn’t change the account.')),
    });
  }

  // ── Helpers ──────────────────────────────────────────────────

  private runDialog<T>(request: Observable<T>, done: (result: T) => void): void {
    this.dialogBusy.set(true);
    this.dialogError.set('');
    request.subscribe({
      next: (result) => {
        this.dialogBusy.set(false);
        this.formDialog.set(null);
        this.passwordTarget.set(null);
        this.deleteTarget.set(null);
        done(result);
      },
      error: (err) => {
        this.dialogBusy.set(false);
        this.dialogError.set(errorMessage(err, 'Something went wrong. Try again.'));
      },
    });
  }

  private replace(updated: AdminUser): void {
    this.users.update((list) => list.map((u) => (u.id === updated.id ? updated : u)));
  }

  private refresh(): void {
    this.reloadTick.update((t) => t + 1);
    this.loadOverview();
  }

  private loadOverview(): void {
    this.api.overview().subscribe({
      next: (overview) => this.overview.set(overview),
      error: () => this.overview.set(null),
    });
  }
}

function loadSort(): UserSort {
  try {
    const saved = JSON.parse(localStorage.getItem(SORT_STORAGE_KEY) ?? 'null');
    const keys: UserSortKey[] = ['username', 'role', 'enabled', 'lastLoginAt', 'createdAt'];
    if (
      saved &&
      keys.includes(saved.key) &&
      (saved.direction === 'asc' || saved.direction === 'desc')
    ) {
      return saved;
    }
  } catch {
    /* fall through to the default */
  }
  return { key: 'username', direction: 'asc' };
}
