import { ChangeDetectorRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LoadingDelayPipe } from './loading-delay';

describe('LoadingDelayPipe', () => {
  let pipe: LoadingDelayPipe;
  const markForCheck = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    markForCheck.mockClear();
    TestBed.configureTestingModule({
      providers: [LoadingDelayPipe, { provide: ChangeDetectorRef, useValue: { markForCheck } }],
    });
    pipe = TestBed.inject(LoadingDelayPipe);
  });

  afterEach(() => vi.useRealTimers());

  it('stays hidden for quick loads', () => {
    expect(pipe.transform(true)).toBe(false);
    vi.advanceTimersByTime(150);
    expect(pipe.transform(false)).toBe(false);
    vi.advanceTimersByTime(500);
    expect(markForCheck).not.toHaveBeenCalled();
  });

  it('shows after 200 ms even when checked repeatedly, and asks for a re-render', () => {
    for (let i = 0; i < 5; i++) {
      pipe.transform(true);
      vi.advanceTimersByTime(50);
    }
    expect(markForCheck).toHaveBeenCalledTimes(1);
    expect(pipe.transform(true)).toBe(true);
    expect(pipe.transform(false)).toBe(false);
  });
});
