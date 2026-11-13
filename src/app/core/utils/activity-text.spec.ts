import { ActivityEntry } from '../models/activity';
import { describeActivity } from './activity-text';

function entry(overrides: Partial<ActivityEntry>): ActivityEntry {
  return {
    id: '1',
    occurredAt: '2026-11-12T10:00:00',
    actorId: 'maja-id',
    actorUsername: 'maja',
    action: 'SIGNED_IN',
    category: 'ACCOUNT',
    targetType: 'USER',
    targetId: 'maja-id',
    targetName: 'maja',
    oldValue: null,
    newValue: null,
    ipAddress: '192.168.1.2',
    ...overrides,
  };
}

function sentence(e: ActivityEntry, meId?: string): string {
  const t = describeActivity(e, meId);
  return [t.actor, t.verb, t.subject, t.connector, t.object].filter(Boolean).join(' ');
}

describe('describeActivity', () => {
  it('writes renames and moves with before and after', () => {
    const rename = entry({
      action: 'FILE_RENAMED',
      targetType: 'FILE',
      targetName: 'b.txt',
      oldValue: 'a.txt',
      newValue: 'b.txt',
    });
    expect(sentence(rename)).toBe('maja renamed a.txt to b.txt');

    const move = entry({
      action: 'FILE_MOVED',
      targetType: 'FILE',
      targetName: 'a.txt',
      newValue: null,
    });
    expect(sentence(move)).toBe('maja moved a.txt to My Files');
  });

  it('speaks to the reader about their own account', () => {
    expect(sentence(entry({}), 'maja-id')).toBe('You signed in');

    const limit = entry({
      actorId: 'ana-id',
      actorUsername: 'ana',
      action: 'USER_STORAGE_LIMIT_CHANGED',
      oldValue: String(50 * 1024 ** 3),
      newValue: String(100 * 1024 ** 3),
    });
    expect(sentence(limit, 'maja-id')).toBe('ana changed your storage limit to 100 GB');
    expect(describeActivity(limit, 'maja-id').detail).toBe('was 50 GB');
    expect(sentence(limit)).toBe('ana changed maja’s storage limit to 100 GB');
  });

  it('marks failed sign-ins as someone, with the reason', () => {
    const failed = entry({
      actorId: null,
      actorUsername: null,
      action: 'SIGN_IN_FAILED',
      newValue: 'wrong password',
    });
    const text = describeActivity(failed);
    expect(sentence(failed)).toBe('Someone failed to sign in as maja');
    expect(text.tone).toBe('danger');
    expect(text.detail).toBe('wrong password');
    expect(sentence(failed, 'maja-id')).toBe('Someone failed to sign in to your account');
  });

  it('credits HomeSilo for housekeeping', () => {
    const expired = entry({
      actorId: null,
      actorUsername: null,
      action: 'TRASH_EXPIRED',
      targetType: null,
      newValue: '7',
    });
    expect(sentence(expired)).toBe('HomeSilo cleared old items from the trash');
    expect(describeActivity(expired).detail).toBe('7 items');
  });

  it('describes setup and invites', () => {
    expect(sentence(entry({ action: 'SERVER_SET_UP' }))).toBe('maja set up HomeSilo');
    expect(
      sentence(
        entry({ action: 'INVITE_CREATED', targetType: null, targetName: 'Mum', newValue: 'USER' }),
      ),
    ).toBe('maja made an invite link for Mum');
    const forAdmin = entry({
      action: 'INVITE_CREATED',
      targetType: null,
      targetName: null,
      newValue: 'ADMIN',
    });
    expect(sentence(forAdmin)).toBe('maja made an invite link');
    expect(describeActivity(forAdmin).detail).toBe('for an admin account');
    expect(sentence(entry({ action: 'INVITE_REVOKED', targetType: null, targetName: 'Mum' }))).toBe(
      'maja revoked an invite link for Mum',
    );
    expect(describeActivity(entry({ action: 'SIGNED_UP', newValue: 'owner' })).detail).toBe(
      'invited by owner',
    );
  });
});
