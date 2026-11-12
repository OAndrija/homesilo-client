import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, finalize, of, switchMap, tap } from 'rxjs';
import { errorMessage } from '../../../core/http/http-error';
import { ActivityCategory, ActivityEntry } from '../../../core/models/activity';
import { ActivityApi } from '../../../core/services/activity';
import { Auth } from '../../../core/services/auth';
import { ActivityItem } from '../../../shared/activity-item/activity-item';
import { LoadingDelayPipe } from '../../../shared/pipes/loading-delay';

const PAGE_SIZE = 50;

interface DayGroup {
  key: string;
  label: string;
  entries: ActivityEntry[];
}

/** The server's activity, newest first, grouped by day. */
@Component({
  selector: 'app-admin-activity',
  imports: [ActivityItem, LoadingDelayPipe],
  templateUrl: './admin-activity.html',
  styleUrl: './admin-activity.css',
})
export class AdminActivity {
  private api = inject(ActivityApi);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  me = inject(Auth).user;

  readonly categories: { value: ActivityCategory | null; label: string }[] = [
    { value: null, label: 'Everything' },
    { value: 'ACCOUNT', label: 'Sign-ins' },
    { value: 'FILES', label: 'Files' },
    { value: 'ADMIN', label: 'Admin' },
  ];

  /** Filter by one account, set from the Users page ("View activity"). */
  private params = toSignal(this.route.queryParamMap, { requireSync: true });
  userId = computed(() => this.params().get('userId'));
  userName = computed(() => this.params().get('name'));

  queryInput = signal('');
  private query = signal('');
  category = signal<ActivityCategory | null>(null);

  entries = signal<ActivityEntry[]>([]);
  page = signal(0);
  hasMore = signal(false);
  loading = signal(true);
  loadingMore = signal(false);
  error = signal('');

  hasFilters = computed(() => !!this.query() || !!this.category() || !!this.userId());

  groups = computed<DayGroup[]>(() => {
    const groups: DayGroup[] = [];
    for (const entry of this.entries()) {
      const date = new Date(entry.occurredAt);
      const key = date.toDateString();
      let group = groups[groups.length - 1];
      if (!group || group.key !== key) {
        group = { key, label: dayLabel(date), entries: [] };
        groups.push(group);
      }
      group.entries.push(entry);
    }
    return groups;
  });

  private queryTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    const filters = computed(() => ({
      query: this.query(),
      category: this.category(),
      userId: this.userId(),
    }));

    toObservable(filters)
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.error.set('');
        }),
        switchMap((f) =>
          this.api.serverActivity(f, 0, PAGE_SIZE).pipe(
            catchError((err) => {
              this.error.set(errorMessage(err, 'Couldn’t load the activity.'));
              return of(null);
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((response) => {
        this.loading.set(false);
        if (!response) return;
        this.entries.set(response.content);
        this.page.set(0);
        this.hasMore.set(!response.last);
      });

    inject(DestroyRef).onDestroy(() => clearTimeout(this.queryTimer));
  }

  onQueryInput(value: string): void {
    this.queryInput.set(value);
    clearTimeout(this.queryTimer);
    this.queryTimer = setTimeout(() => this.query.set(value.trim()), 250);
  }

  setCategory(value: ActivityCategory | null): void {
    this.category.set(value);
  }

  clearUser(): void {
    this.router.navigate([], {
      queryParams: { userId: null, name: null },
      queryParamsHandling: 'merge',
    });
  }

  clearFilters(): void {
    clearTimeout(this.queryTimer);
    this.queryInput.set('');
    this.query.set('');
    this.category.set(null);
    if (this.userId()) this.clearUser();
  }

  loadMore(): void {
    const next = this.page() + 1;
    this.loadingMore.set(true);
    this.api
      .serverActivity(
        { query: this.query(), category: this.category(), userId: this.userId() },
        next,
        PAGE_SIZE,
      )
      .pipe(finalize(() => this.loadingMore.set(false)))
      .subscribe({
        next: (response) => {
          this.entries.update((list) => [...list, ...response.content]);
          this.page.set(next);
          this.hasMore.set(!response.last);
        },
        error: (err) => this.error.set(errorMessage(err, 'Couldn’t load more activity.')),
      });
  }
}

function dayLabel(date: Date): string {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  const sameYear = date.getFullYear() === today.getFullYear();
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}
