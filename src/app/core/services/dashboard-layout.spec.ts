import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DEFAULT_LAYOUT, PlacedTile } from '../models/dashboard-layout';
import { Auth } from './auth';
import { DashboardLayoutService } from './dashboard-layout';

const URL = '/api/v1/dashboard/layout';

describe('DashboardLayoutService', () => {
  let service: DashboardLayoutService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Auth, useValue: { user: signal({ id: 'u1' }) } },
      ],
    });
    service = TestBed.inject(DashboardLayoutService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('uses the default until someone saves a layout', () => {
    service.load();
    expect(service.tiles()).toBeNull();
    http.expectOne(URL).flush({ customized: false, tiles: [], updatedAt: null });
    expect(service.tiles()).toEqual([...DEFAULT_LAYOUT]);
  });

  it('shows the copy kept in this browser first, then the server copy', () => {
    localStorage.setItem('hs-dashboard-u1', JSON.stringify([{ id: 'recent', size: 'wide' }]));
    service.load();
    expect(service.tiles()).toEqual([{ id: 'recent', size: 'wide' }]);
    http.expectOne(URL).flush({
      customized: true,
      tiles: [{ id: 'storage', size: 'small' }],
      updatedAt: '2026-11-12T20:00:00',
    });
    expect(service.tiles()).toEqual([{ id: 'storage', size: 'small' }]);
    expect(JSON.parse(localStorage.getItem('hs-dashboard-u1')!)).toEqual([
      { id: 'storage', size: 'small' },
    ]);
  });

  it('falls back to the default when the server cannot be reached', () => {
    service.load();
    http.expectOne(URL).flush('down', { status: 503, statusText: 'Unavailable' });
    expect(service.tiles()).toEqual([...DEFAULT_LAYOUT]);
  });

  it('saves a custom layout and stores the default as "not customized"', () => {
    const custom: PlacedTile[] = [{ id: 'photos', size: 'wide' }];
    service.save(custom).subscribe();
    const put = http.expectOne(URL);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({ tiles: custom });
    put.flush({ customized: true, tiles: custom, updatedAt: '2026-11-12T20:00:00' });
    expect(service.tiles()).toEqual(custom);

    service.save([...DEFAULT_LAYOUT]).subscribe();
    const reset = http.expectOne(URL);
    expect(reset.request.method).toBe('DELETE');
    reset.flush(null, { status: 204, statusText: 'No Content' });
    expect(service.tiles()).toEqual([...DEFAULT_LAYOUT]);
  });
});
