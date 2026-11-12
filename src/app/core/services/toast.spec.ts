import { TestBed } from '@angular/core/testing';
import { ToastService } from './toast';

describe('ToastService', () => {
  let toast: ToastService;

  beforeEach(() => {
    vi.useFakeTimers();
    toast = TestBed.inject(ToastService);
  });

  afterEach(() => vi.useRealTimers());

  it('dismisses plain toasts after a few seconds', () => {
    toast.success('Saved');
    vi.advanceTimersByTime(3900);
    expect(toast.toasts().length).toBe(1);
    vi.advanceTimersByTime(200);
    expect(toast.toasts()).toEqual([]);
  });

  it('keeps toasts with an Undo up long enough to reach it, and runs it once', () => {
    const run = vi.fn();
    toast.success('Moved to trash', { label: 'Undo', run });
    vi.advanceTimersByTime(6000);
    const [shown] = toast.toasts();
    toast.runAction(shown);
    toast.runAction(shown);
    expect(run).toHaveBeenCalledTimes(1);
    expect(toast.toasts()).toEqual([]);
  });

  it('shows at most three at a time, dropping the oldest', () => {
    ['a', 'b', 'c', 'd'].forEach((m) => toast.info(m));
    expect(toast.toasts().map((t) => t.message)).toEqual(['b', 'c', 'd']);
  });
});
