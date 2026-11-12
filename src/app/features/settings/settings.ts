import { DatePipe, DecimalPipe } from '@angular/common';
import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  signal,
} from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { errorMessage } from '../../core/http/http-error';
import { Auth } from '../../core/services/auth';
import { DashboardStore } from '../../core/services/dashboard-store';
import { ThemePreference, ThemeService } from '../../core/services/theme';
import { formatBytes } from '../../core/utils/format';
import { ActivityEntry } from '../../core/models/activity';
import { ActivityApi } from '../../core/services/activity';
import { ActivityItem } from '../../shared/activity-item/activity-item';

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const next = group.get('newPassword')?.value;
  const confirm = group.get('confirmPassword')?.value;
  return next && confirm && next !== confirm ? { mismatch: true } : null;
}

type SectionId = 'account' | 'appearance' | 'security' | 'activity' | 'storage';

@Component({
  selector: 'app-settings',
  imports: [ReactiveFormsModule, DatePipe, DecimalPipe, RouterLink, ActivityItem],
  templateUrl: './settings.html',
  styleUrl: './settings.css',
})
export class Settings {
  private auth = inject(Auth);
  private store = inject(DashboardStore);
  protected themeService = inject(ThemeService);
  private host = inject(ElementRef<HTMLElement>);
  private activityApi = inject(ActivityApi);

  user = this.auth.user;
  initial = computed(() => (this.user()?.username ?? '?').charAt(0).toUpperCase());

  readonly sections: { id: SectionId; label: string; icon: string }[] = [
    { id: 'account', label: 'Account', icon: 'person' },
    { id: 'appearance', label: 'Appearance', icon: 'palette' },
    { id: 'security', label: 'Security', icon: 'lock' },
    { id: 'activity', label: 'Recent activity', icon: 'history' },
    { id: 'storage', label: 'Storage', icon: 'database' },
  ];
  activeSection = signal<SectionId>('account');
  /** After a nav click, keep that item highlighted while the page scrolls to it. */
  private holdHighlightUntil = 0;

  readonly themeOptions: { value: ThemePreference; label: string; hint: string }[] = [
    { value: 'system', label: 'System', hint: 'Match your device' },
    { value: 'light', label: 'Light', hint: 'Bright and clean' },
    { value: 'dark', label: 'Dark', hint: 'Easy on the eyes' },
  ];

  // ── Storage ──
  stats = this.store.stats;
  usedBytes = computed(() => this.stats()?.storageUsedBytes ?? 0);
  quotaBytes = computed(
    () => this.stats()?.storageQuotaBytes ?? this.user()?.storageQuotaBytes ?? 0,
  );
  trashedBytes = computed(() => this.stats()?.trashedBytes ?? 0);
  usedPercent = computed(() => {
    const quota = this.quotaBytes();
    return quota > 0 ? Math.min(100, (this.usedBytes() / quota) * 100) : 0;
  });
  retentionDays = computed(() => this.stats()?.trashRetentionDays ?? 0);
  readonly formatBytes = formatBytes;

  // ── Password ──
  form = new FormGroup(
    {
      currentPassword: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      newPassword: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(8), Validators.maxLength(128)],
      }),
      confirmPassword: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
    },
    { validators: passwordsMatch },
  );

  showPasswords = signal(false);
  submitted = signal(false);
  saving = signal(false);
  errorMessage = signal('');
  success = signal(false);

  // ── Recent activity on this account ──────────────────────────
  activity = signal<ActivityEntry[]>([]);
  activityPage = signal(0);
  activityHasMore = signal(false);
  activityLoading = signal(true);
  activityError = signal('');
  /** Failed or blocked sign-ins among those shown, to call out at the top. */
  failedSignIns = computed(
    () =>
      this.activity().filter((e) => e.action === 'SIGN_IN_FAILED' || e.action === 'SIGN_IN_BLOCKED')
        .length,
  );

  constructor() {
    this.store.ensureLoaded();
    this.loadActivity(0);

    // Highlight the section being read in the side navigation.
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      if (typeof IntersectionObserver === 'undefined') return;
      const observer = new IntersectionObserver(
        (entries) => {
          if (Date.now() < this.holdHighlightUntil) return;
          const visible = entries.filter((e) => e.isIntersecting);
          if (visible.length > 0) this.activeSection.set(visible[0].target.id as SectionId);
        },
        { rootMargin: '-35% 0px -55% 0px' },
      );
      for (const section of this.sections) {
        const el = this.host.nativeElement.querySelector(`#${section.id}`);
        if (el) observer.observe(el);
      }
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  loadActivity(page: number): void {
    this.activityLoading.set(true);
    this.activityApi
      .myActivity(page, 10)
      .pipe(finalize(() => this.activityLoading.set(false)))
      .subscribe({
        next: (response) => {
          this.activity.update((list) =>
            page === 0 ? response.content : [...list, ...response.content],
          );
          this.activityPage.set(page);
          this.activityHasMore.set(!response.last);
          this.activityError.set('');
        },
        error: (err) =>
          this.activityError.set(errorMessage(err, 'Couldn’t load your recent activity.')),
      });
  }

  goTo(id: SectionId): void {
    this.activeSection.set(id);
    this.holdHighlightUntil = Date.now() + 1000;
    this.host.nativeElement
      .querySelector(`#${id}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  setTheme(preference: ThemePreference): void {
    this.themeService.setPreference(preference);
  }

  onSubmit(): void {
    this.submitted.set(true);
    this.errorMessage.set('');
    this.success.set(false);
    if (this.form.invalid) return;

    const { currentPassword, newPassword } = this.form.getRawValue();
    this.saving.set(true);
    this.auth
      .changePassword({ currentPassword, newPassword })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.success.set(true);
          this.submitted.set(false);
          this.form.reset();
        },
        error: (err) => this.errorMessage.set(errorMessage(err, 'Could not change your password.')),
      });
  }
}
