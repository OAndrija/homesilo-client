import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StorageIndicator } from './storage-indicator';

describe('StorageIndicator', () => {
  let component: StorageIndicator;
  let fixture: ComponentFixture<StorageIndicator>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StorageIndicator],
    }).compileComponents();

    fixture = TestBed.createComponent(StorageIndicator);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
