import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Invite, inviteLink } from '../../../core/models/invite';
import { expiresIn, InvitesPanel } from './invites-panel';

const OPEN: Invite = {
  id: 'i1',
  role: 'USER',
  note: 'Mum',
  status: 'PENDING',
  createdBy: 'owner',
  createdAt: '2026-11-13T10:00:00',
  expiresAt: '2026-11-20T10:00:00',
  usedBy: null,
  usedAt: null,
};

describe('InvitesPanel', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists open invites apart from used ones, and revokes', () => {
    const fixture = TestBed.createComponent(InvitesPanel);
    const used: Invite = { ...OPEN, id: 'i2', note: 'Dad', status: 'USED', usedBy: 'dad' };
    http.expectOne('/api/v1/admin/invites').flush([OPEN, used]);
    fixture.detectChanges();
    const panel = fixture.componentInstance;
    expect(panel.open().map((i) => i.id)).toEqual(['i1']);
    expect(panel.finished().map((i) => i.id)).toEqual(['i2']);

    const revoke = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      'button[aria-label="Revoke invite: Mum"]',
    )!;
    revoke.click();
    const req = http.expectOne('/api/v1/admin/invites/i1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    expect(panel.open()).toEqual([]);
  });
});

describe('invite helpers', () => {
  it('puts the secret after the #, out of server logs', () => {
    expect(inviteLink('abc', 'https://silo.home')).toBe('https://silo.home/invite#abc');
  });

  it('says how long an open invite has left', () => {
    const now = new Date('2026-11-13T10:00:00').getTime();
    expect(expiresIn('2026-11-20T10:00:00', now)).toBe('Expires in 7 days');
    expect(expiresIn('2026-11-14T10:00:00', now)).toBe('Expires in 1 day');
    expect(expiresIn('2026-11-13T13:00:00', now)).toBe('Expires in 3 hours');
    expect(expiresIn('2026-11-13T10:10:00', now)).toBe('Expires in 1 hour');
  });
});
