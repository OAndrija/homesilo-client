import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { errorMessage } from '../../../core/http/http-error';
import { BackupStatus, ServerSettings } from '../../../core/models/server-settings';
import { AdminApi } from '../../../core/services/admin';
import { formatBytes } from '../../../core/utils/format';
import { ExactDatePipe, FriendlyDatePipe } from '../../../shared/pipes/friendly-date';

const GB = 1024 ** 3;
const BACKUP_GUIDE = 'https://github.com/OAndrija/homesilo-server/blob/main/docs/backups.md';

type Message = { text: string; error: boolean } | null;

/**
 * Settings for everyone on this server (sign-up, storage, clean-up) and the
 * state of its database backups.
 */
@Component({
  selector: 'app-server-settings',
  imports: [RouterLink, FriendlyDatePipe, ExactDatePipe],
  templateUrl: './server-settings.html',
  styleUrls: ['../../settings/settings.css', './server-settings.css'],
})
export class ServerSettingsPage {
  private api = inject(AdminApi);

  readonly backupGuide = BACKUP_GUIDE;
  readonly formatBytes = formatBytes;

  settings = signal<ServerSettings | null>(null);
  loadError = signal('');

  /** The form's values; saved together with Save. */
  quotaGb = signal(0);
  trashDays = signal(0);
  activityDays = signal(0);
  saving = signal(false);
  savedMessage = signal<Message>(null);
  signUpMessage = signal<Message>(null);
  togglingSignUp = signal(false);

  dirty = computed(() => {
    const s = this.settings();
    if (!s) return false;
    return (
      Math.round(this.quotaGb() * GB) !== s.defaultQuotaBytes ||
      this.trashDays() !== s.trashRetentionDays ||
      this.activityDays() !== s.activityRetentionDays
    );
  });
  valid = computed(
    () =>
      this.quotaGb() >= 0 &&
      Number.isInteger(this.trashDays()) &&
      this.trashDays() >= 0 &&
      this.trashDays() <= 3650 &&
      Number.isInteger(this.activityDays()) &&
      this.activityDays() >= 0 &&
      this.activityDays() <= 3650,
  );

  backups = signal<BackupStatus | null>(null);
  backingUp = signal(false);
  backupMessage = signal<Message>(null);
  latest = computed(() => this.backups()?.backups[0] ?? null);

  constructor() {
    this.api.settings().subscribe({
      next: (s) => this.show(s),
      error: (err) => this.loadError.set(errorMessage(err, "Settings couldn't be loaded.")),
    });
    this.api.backups().subscribe({
      next: (b) => this.backups.set(b),
      error: () => this.backups.set(null),
    });
  }

  toggleSignUp(open: boolean): void {
    this.togglingSignUp.set(true);
    this.signUpMessage.set(null);
    this.api.updateSettings({ registrationOpen: open }).subscribe({
      next: (s) => {
        this.togglingSignUp.set(false);
        this.settings.update((current) =>
          current ? { ...current, registrationOpen: s.registrationOpen } : s,
        );
        this.signUpMessage.set({
          text: open ? 'Anyone can now create an account.' : 'Sign-up is now by invite only.',
          error: false,
        });
      },
      error: (err) => {
        this.togglingSignUp.set(false);
        this.signUpMessage.set({
          text: errorMessage(err, "That didn't save. Try again."),
          error: true,
        });
      },
    });
  }

  save(): void {
    if (!this.dirty() || !this.valid()) return;
    this.saving.set(true);
    this.savedMessage.set(null);
    this.api
      .updateSettings({
        defaultQuotaBytes: Math.round(this.quotaGb() * GB),
        trashRetentionDays: this.trashDays(),
        activityRetentionDays: this.activityDays(),
      })
      .subscribe({
        next: (s) => {
          this.saving.set(false);
          this.show(s);
          this.savedMessage.set({ text: 'Saved.', error: false });
        },
        error: (err) => {
          this.saving.set(false);
          this.savedMessage.set({
            text: errorMessage(err, "That didn't save. Try again."),
            error: true,
          });
        },
      });
  }

  backUpNow(): void {
    this.backingUp.set(true);
    this.backupMessage.set(null);
    this.api.backUpNow().subscribe({
      next: (b) => {
        this.backingUp.set(false);
        this.backups.set(b);
        this.backupMessage.set({ text: 'Backup made.', error: false });
      },
      error: (err) => {
        this.backingUp.set(false);
        this.backupMessage.set({ text: errorMessage(err, 'The backup failed.'), error: true });
        this.api.backups().subscribe({ next: (b) => this.backups.set(b) });
      },
    });
  }

  /** "every day at 02:00" from a Spring cron like "0 0 2 * * *"; the raw cron otherwise. */
  schedule(cron: string): string {
    const parts = cron.trim().split(/\s+/);
    if (
      parts.length === 6 &&
      parts.slice(3).every((p) => p === '*') &&
      /^\d+$/.test(parts[1] + parts[2])
    ) {
      return `every day at ${parts[2].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
    }
    return `on the schedule ${cron}`;
  }

  number(event: Event): number {
    const value = (event.target as HTMLInputElement).valueAsNumber;
    return Number.isFinite(value) ? value : -1;
  }

  private show(s: ServerSettings): void {
    this.settings.set(s);
    this.quotaGb.set(Math.round((s.defaultQuotaBytes / GB) * 100) / 100);
    this.trashDays.set(s.trashRetentionDays);
    this.activityDays.set(s.activityRetentionDays);
  }
}
