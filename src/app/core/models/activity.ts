export type ActivityCategory = 'ACCOUNT' | 'FILES' | 'ADMIN';

export type ActivityAction =
  | 'SIGNED_UP'
  | 'SIGNED_IN'
  | 'SIGN_IN_FAILED'
  | 'SIGN_IN_BLOCKED'
  | 'SIGNED_OUT'
  | 'PASSWORD_CHANGED'
  | 'FILE_UPLOADED'
  | 'FILE_RENAMED'
  | 'FILE_MOVED'
  | 'FILE_TRASHED'
  | 'FILE_RESTORED'
  | 'FILE_DELETED'
  | 'FOLDER_CREATED'
  | 'FOLDER_RENAMED'
  | 'FOLDER_MOVED'
  | 'FOLDER_TRASHED'
  | 'FOLDER_RESTORED'
  | 'FOLDER_DELETED'
  | 'TRASH_EMPTIED'
  | 'TRASH_EXPIRED'
  | 'SERVER_SET_UP'
  | 'USER_CREATED'
  | 'INVITE_CREATED'
  | 'INVITE_REVOKED'
  | 'USER_ROLE_CHANGED'
  | 'USER_STORAGE_LIMIT_CHANGED'
  | 'USER_DISABLED'
  | 'USER_ENABLED'
  | 'USER_PASSWORD_RESET'
  | 'USER_DELETED';

/** One activity log entry; see the server's ActivityAction for what old/new values hold. */
export interface ActivityEntry {
  id: string;
  occurredAt: string;
  /** Null when HomeSilo did it, or for a sign-in attempt. */
  actorId: string | null;
  actorUsername: string | null;
  action: ActivityAction;
  category: ActivityCategory;
  targetType: 'FILE' | 'FOLDER' | 'USER' | null;
  targetId: string | null;
  targetName: string | null;
  oldValue: string | null;
  newValue: string | null;
  ipAddress: string | null;
}

export interface ActivityFilters {
  query: string;
  category: ActivityCategory | null;
  userId: string | null;
}
