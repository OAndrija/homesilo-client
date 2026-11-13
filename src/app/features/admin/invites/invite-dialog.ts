import { DatePipe } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { errorMessage } from '../../../core/http/http-error';
import { UserRole } from '../../../core/models/auth.models';
import { CreatedInvite, inviteLink } from '../../../core/models/invite';
import { AdminApi } from '../../../core/services/admin';

export const INVITE_LENGTHS = [
  { days: 1, label: '1 day' },
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
] as const;

/**
 * Making an invite link: who it's for, how long it works, and what the new
 * account will be; then the link, to copy or share. The link is shown only here.
 */
@Component({
  selector: 'app-invite-dialog',
  imports: [DatePipe],
  templateUrl: './invite-dialog.html',
  styleUrls: ['../../../shared/dialog/dialog.css', '../admin-dialog.css', './invite-dialog.css'],
})
export class InviteDialog implements AfterViewInit {
  private api = inject(AdminApi);

  /** A new invite was made (the list should show it). */
  created = output<CreatedInvite>();
  closed = output<void>();

  private noteField = viewChild<ElementRef<HTMLInputElement>>('noteField');
  private linkField = viewChild<ElementRef<HTMLInputElement>>('linkField');

  readonly lengths = INVITE_LENGTHS;
  readonly canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  note = signal('');
  days = signal(7);
  role = signal<UserRole>('USER');
  busy = signal(false);
  error = signal('');
  result = signal<{ link: string; created: CreatedInvite } | null>(null);
  copied = signal(false);

  ngAfterViewInit(): void {
    this.noteField()?.nativeElement.focus();
  }

  submit(): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    const note = this.note().trim();
    this.api
      .createInvite({ expiresInDays: this.days(), role: this.role(), ...(note ? { note } : {}) })
      .subscribe({
        next: (created) => {
          this.busy.set(false);
          this.result.set({ link: inviteLink(created.token), created });
          this.created.emit(created);
          setTimeout(() => this.linkField()?.nativeElement.select());
        },
        error: (err) => {
          this.busy.set(false);
          this.error.set(errorMessage(err, "The invite couldn't be made. Try again."));
        },
      });
  }

  async copy(): Promise<void> {
    const link = this.result()?.link;
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      // No clipboard access: select it so Ctrl+C works.
      this.linkField()?.nativeElement.select();
    }
  }

  async share(): Promise<void> {
    const link = this.result()?.link;
    if (!link) return;
    try {
      await navigator.share({
        title: 'Join me on HomeSilo',
        text: 'Here’s your invite to HomeSilo. The link works once.',
        url: link,
      });
    } catch {
      // Cancelled, or not allowed here: the link is still on screen to copy.
    }
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as Element).hasAttribute('data-dialog-backdrop') && !this.busy()) {
      this.closed.emit();
    }
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && !this.busy()) {
      event.stopPropagation();
      this.closed.emit();
    }
  }
}
