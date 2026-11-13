import { Component, computed, ElementRef, inject, output, signal, viewChild } from '@angular/core';
import { errorMessage } from '../../../core/http/http-error';
import { Invite } from '../../../core/models/invite';
import { AdminApi } from '../../../core/services/admin';
import { ExactDatePipe, FriendlyDatePipe } from '../../../shared/pipes/friendly-date';

const DAY = 86_400_000;

/** "Expires in 6 days", "Expires today", for an open invite. */
export function expiresIn(expiresAt: string, now = Date.now()): string {
  const left = new Date(expiresAt).getTime() - now;
  if (left < DAY) {
    const hours = Math.max(1, Math.round(left / 3_600_000));
    return `Expires in ${hours} hour${hours === 1 ? '' : 's'}`;
  }
  const days = Math.round(left / DAY);
  return `Expires in ${days} day${days === 1 ? '' : 's'}`;
}

/**
 * The invite links admins have made: open ones first, with Revoke; used and
 * expired ones underneath for a while, as a record of who joined how.
 */
@Component({
  selector: 'app-invites-panel',
  imports: [FriendlyDatePipe, ExactDatePipe],
  templateUrl: './invites-panel.html',
  styleUrl: './invites-panel.css',
})
export class InvitesPanel {
  private api = inject(AdminApi);

  /** The admin wants to make an invite. */
  inviteSomeone = output<void>();

  invites = signal<Invite[] | null>(null);
  error = signal('');
  revoking = signal<string | null>(null);
  showFinished = signal(false);

  open = computed(() => (this.invites() ?? []).filter((i) => i.status === 'PENDING'));
  finished = computed(() => (this.invites() ?? []).filter((i) => i.status !== 'PENDING'));
  readonly expiresIn = expiresIn;
  private inviteButton = viewChild<ElementRef<HTMLButtonElement>>('inviteButton');

  constructor() {
    this.reload();
  }

  reload(): void {
    this.api.listInvites().subscribe({
      next: (invites) => {
        this.invites.set(invites);
        this.error.set('');
      },
      error: (err) => this.error.set(errorMessage(err, "Invites couldn't be loaded.")),
    });
  }

  revoke(invite: Invite): void {
    this.revoking.set(invite.id);
    this.api.revokeInvite(invite.id).subscribe({
      next: () => {
        this.revoking.set(null);
        this.invites.update((list) => (list ?? []).filter((i) => i.id !== invite.id));
      },
      error: (err) => {
        this.revoking.set(null);
        this.error.set(errorMessage(err, "The invite couldn't be revoked."));
        this.reload();
      },
    });
  }

  /** Back to the button once the invite dialog closes. */
  focusInviteButton(): void {
    this.inviteButton()?.nativeElement.focus();
  }

  label(invite: Invite): string {
    return invite.note || 'Invite';
  }
}
