import { UserRole } from './auth.models';

export type InviteStatus = 'PENDING' | 'USED' | 'EXPIRED';

/** An invite link as admins see it in the list (the link itself is shown only once). */
export interface Invite {
  id: string;
  role: UserRole;
  /** Who it's for, as the admin put it. */
  note: string | null;
  status: InviteStatus;
  createdBy: string | null;
  createdAt: string;
  expiresAt: string;
  usedBy: string | null;
  usedAt: string | null;
}

export interface NewInvite {
  expiresInDays: number;
  role: UserRole;
  note?: string;
}

/** A new invite and the secret for its link; the only time the secret is available. */
export interface CreatedInvite {
  invite: Invite;
  token: string;
}

/** What the sign-up page shows for a working invite link. */
export interface InvitePreview {
  invitedBy: string | null;
  expiresAt: string;
}

/**
 * The link to send. The secret goes after the #, which browsers never send to
 * the server, so it stays out of server logs and Referer headers.
 */
export function inviteLink(token: string, origin = window.location.origin): string {
  return `${origin}/invite#${token}`;
}
