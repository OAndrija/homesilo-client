import { ActivityEntry } from '../models/activity';
import { formatBytes } from './format';
import { formatLimit } from './storage-size';

export type ActivityTone = 'neutral' | 'good' | 'warn' | 'danger' | 'admin';

/**
 * An entry as a sentence: "<actor> <verb> <subject> <connector> <object>", with the
 * actor, subject and object shown in bold, plus an optional quieter detail.
 */
export interface ActivityText {
  icon: string;
  tone: ActivityTone;
  actor: string;
  verb: string;
  subject?: string;
  connector?: string;
  object?: string;
  detail?: string;
}

const MY_FILES = 'My Files';

function count(value: string | null, one: string, many: string): string {
  const n = Number(value ?? 0);
  return `${n} ${n === 1 ? one : many}`;
}

function role(value: string | null): string {
  return value === 'ADMIN' ? 'an admin' : 'a member';
}

/**
 * Describes an entry in plain English. With `meId`, it is written from that person's
 * point of view ("You signed in", "ana changed your storage limit").
 */
export function describeActivity(entry: ActivityEntry, meId?: string | null): ActivityText {
  const isMe = !!meId && entry.actorId === meId;
  const actor = isMe ? 'You' : (entry.actorUsername ?? (entry.actorId ? 'Someone' : 'HomeSilo'));
  const aboutMe = !!meId && entry.targetType === 'USER' && entry.targetId === meId;
  const name = entry.targetName ?? '';
  const person = aboutMe ? 'you' : name;
  const theirs = aboutMe ? 'your' : `${name}’s`;
  const own = isMe ? 'your' : 'their';

  switch (entry.action) {
    case 'SIGNED_UP':
      return { icon: 'person_add', tone: 'good', actor, verb: 'created an account' };
    case 'SIGNED_IN':
      return { icon: 'login', tone: 'neutral', actor, verb: 'signed in' };
    case 'SIGNED_OUT':
      return { icon: 'logout', tone: 'neutral', actor, verb: 'signed out' };
    case 'PASSWORD_CHANGED':
      return { icon: 'key', tone: 'neutral', actor, verb: `changed ${own} password` };
    case 'SIGN_IN_FAILED':
      return {
        icon: 'gpp_maybe',
        tone: 'danger',
        actor: 'Someone',
        verb: aboutMe ? 'failed to sign in to your account' : 'failed to sign in as',
        subject: aboutMe ? undefined : name,
        detail: entry.newValue ?? undefined,
      };
    case 'SIGN_IN_BLOCKED':
      return {
        icon: 'block',
        tone: 'danger',
        actor: 'Someone',
        verb: aboutMe
          ? 'was blocked from signing in to your account'
          : 'was blocked from signing in as',
        subject: aboutMe ? undefined : name,
        detail: 'too many attempts',
      };

    case 'FILE_UPLOADED':
      return {
        icon: 'upload',
        tone: 'good',
        actor,
        verb: 'uploaded',
        subject: name,
        detail: entry.newValue ? formatBytes(Number(entry.newValue)) : undefined,
      };
    case 'FILE_RENAMED':
    case 'FOLDER_RENAMED':
      return {
        icon: 'edit',
        tone: 'neutral',
        actor,
        verb: 'renamed',
        subject: entry.oldValue ?? name,
        connector: 'to',
        object: entry.newValue ?? name,
      };
    case 'FILE_MOVED':
    case 'FOLDER_MOVED':
      return {
        icon: 'drive_file_move',
        tone: 'neutral',
        actor,
        verb: 'moved',
        subject: name,
        connector: 'to',
        object: entry.newValue ?? MY_FILES,
        detail: `from ${entry.oldValue ?? MY_FILES}`,
      };
    case 'FILE_TRASHED':
    case 'FOLDER_TRASHED':
      return {
        icon: 'delete',
        tone: 'warn',
        actor,
        verb: 'moved',
        subject: name,
        connector: 'to the trash',
      };
    case 'FILE_RESTORED':
    case 'FOLDER_RESTORED':
      return {
        icon: 'restore_from_trash',
        tone: 'good',
        actor,
        verb: 'restored',
        subject: name,
        connector: 'from the trash',
      };
    case 'FILE_DELETED':
      return {
        icon: 'delete_forever',
        tone: 'danger',
        actor,
        verb: 'deleted',
        subject: name,
        connector: 'for good',
      };
    case 'FOLDER_DELETED':
      return {
        icon: 'delete_forever',
        tone: 'danger',
        actor,
        verb: 'deleted',
        subject: name,
        connector: 'for good',
        detail: `with ${count(entry.newValue, 'file', 'files')}`,
      };
    case 'FOLDER_CREATED':
      return {
        icon: 'create_new_folder',
        tone: 'good',
        actor,
        verb: 'created the folder',
        subject: name,
        detail: entry.newValue ? `in ${entry.newValue}` : undefined,
      };
    case 'TRASH_EMPTIED':
      return {
        icon: 'delete_sweep',
        tone: 'danger',
        actor,
        verb: `emptied ${own} trash`,
        detail: count(entry.newValue, 'item', 'items'),
      };
    case 'TRASH_EXPIRED':
      return {
        icon: 'auto_delete',
        tone: 'neutral',
        actor: 'HomeSilo',
        verb: 'cleared old items from the trash',
        detail: count(entry.newValue, 'item', 'items'),
      };

    case 'USER_CREATED':
      return {
        icon: 'person_add',
        tone: 'admin',
        actor,
        verb: 'added',
        subject: person,
        connector: `as ${role(entry.newValue)}`,
      };
    case 'USER_ROLE_CHANGED':
      return {
        icon: 'shield_person',
        tone: 'admin',
        actor,
        verb: 'made',
        subject: person,
        connector: role(entry.newValue),
      };
    case 'USER_STORAGE_LIMIT_CHANGED':
      return {
        icon: 'database',
        tone: 'admin',
        actor,
        verb: `changed ${theirs} storage limit`,
        connector: 'to',
        object: formatLimit(Number(entry.newValue ?? 0)),
        detail: entry.oldValue ? `was ${formatLimit(Number(entry.oldValue))}` : undefined,
      };
    case 'USER_DISABLED':
      return {
        icon: 'block',
        tone: 'warn',
        actor,
        verb: aboutMe ? 'disabled your account' : 'disabled',
        subject: aboutMe ? undefined : name,
      };
    case 'USER_ENABLED':
      return {
        icon: 'check_circle',
        tone: 'good',
        actor,
        verb: aboutMe ? 'enabled your account' : 'enabled',
        subject: aboutMe ? undefined : name,
      };
    case 'USER_PASSWORD_RESET':
      return {
        icon: 'password',
        tone: 'admin',
        actor,
        verb: 'set a new password for',
        subject: person,
      };
    case 'USER_DELETED':
      return {
        icon: 'person_remove',
        tone: 'danger',
        actor,
        verb: 'deleted the account',
        subject: name,
        detail: `and ${count(entry.newValue, 'file', 'files')}`,
      };
  }
}
