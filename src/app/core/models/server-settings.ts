/** Settings for everyone on the server, as admins see them. */
export interface ServerSettings {
  /** Anyone can create an account; otherwise it takes an invite. */
  registrationOpen: boolean;
  /** Storage each new account starts with. */
  defaultQuotaBytes: number;
  /** Days before trashed items are deleted; 0 keeps them. */
  trashRetentionDays: number;
  /** Days the activity log is kept; 0 keeps it forever. */
  activityRetentionDays: number;
  /** Largest single file; set with MAX_UPLOAD_SIZE on the server, not here. */
  maxUploadBytes: number;
}

export type ServerSettingsChange = Partial<Omit<ServerSettings, 'maxUploadBytes'>>;

export interface Backup {
  name: string;
  sizeBytes: number;
  createdAt: string;
}

/** Database backups: what's there and how the last attempt went. */
export interface BackupStatus {
  enabled: boolean;
  location: string;
  schedule: string;
  keep: number;
  running: boolean;
  lastAttemptAt: string | null;
  lastError: string | null;
  backups: Backup[];
}
