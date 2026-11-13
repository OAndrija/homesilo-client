import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Injector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DEFAULT_SORT, SORT_KEYS } from '../models/sort';
import { parseSort, sortChange, sortSetting, viewChange, viewSetting } from './list-settings';
import { PreferencesService } from './preferences';

describe('list settings', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('hs-prefs-claimed', '1');
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  it('reads a sort only if it is a column the list has', () => {
    expect(parseSort('name,asc', SORT_KEYS)).toEqual({ key: 'name', direction: 'asc' });
    expect(parseSort('evil,asc', SORT_KEYS)).toBeNull();
    expect(parseSort('name,up', SORT_KEYS)).toBeNull();
    expect(parseSort(undefined, SORT_KEYS)).toBeNull();
  });

  it("doesn't store defaults", () => {
    expect(viewChange('starred', 'list')).toEqual({ 'view.starred': null });
    expect(viewChange('starred', 'grid')).toEqual({ 'view.starred': 'grid' });
    expect(sortChange('trash', DEFAULT_SORT, DEFAULT_SORT)).toEqual({ 'sort.trash': null });
    expect(sortChange('trash', { key: 'size', direction: 'asc' }, DEFAULT_SORT)).toEqual({
      'sort.trash': 'size,asc',
    });
  });

  it("follows the account's settings when they arrive", () => {
    const injector = TestBed.inject(Injector);
    const http = TestBed.inject(HttpTestingController);
    const view = runInInjectionContext(injector, () => viewSetting('starred'));
    const sort = runInInjectionContext(injector, () =>
      sortSetting('starred', SORT_KEYS, DEFAULT_SORT),
    );
    expect(view()).toBe('list');
    expect(sort()).toEqual(DEFAULT_SORT);

    TestBed.inject(PreferencesService).load('ana').subscribe();
    http
      .expectOne('/api/v1/users/me/preferences')
      .flush({ values: { 'view.starred': 'grid', 'sort.starred': 'name,asc' }, updatedAt: null });

    expect(view()).toBe('grid');
    expect(sort()).toEqual({ key: 'name', direction: 'asc' });
  });
});
