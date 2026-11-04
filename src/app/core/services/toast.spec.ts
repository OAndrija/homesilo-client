import { TestBed } from '@angular/core/testing';
import { ToastService } from './toast';

describe('ToastService', () => {
  let toast: ToastService;

  beforeEach(() => {
    vi.useFakeTimers();
    toast = TestBed.inject(ToastService);
  });

  afterEach(() => vi.useRealTimers());

  it('auto-dismisses success toasts', () => {
    toast.success('Saved');
    expect(toast.toasts().map((t) => t.message)).toEqual(['Saved']);
    vi.advanceTimersByTime(4000);
    expect(toast.toasts()).toEqual([]);
  });

  it('keeps errors on screen longer than successes', () => {
    toast.error('Nope');
    vi.advanceTimersByTime(4000);
    expect(toast.toasts().length).toBe(1);
    vi.advanceTimersByTime(3000);
    expect(toast.toasts().length).toBe(0);
  });

  it('keeps progress toasts until they are updated', () => {
    const id = toast.progress('Uploading 1 of 3…');
    vi.advanceTimersByTime(60_000);
    expect(toast.toasts()[0].kind).toBe('progress');

    toast.update(id, 'success', 'Uploaded 3 files');
    expect(toast.toasts()).toEqual([
      expect.objectContaining({ id, kind: 'success', message: 'Uploaded 3 files' }),
    ]);
    vi.advanceTimersByTime(4000);
    expect(toast.toasts()).toEqual([]);
  });

  it('carries an action such as Undo', () => {
    const run = vi.fn();
    toast.success('Moved to trash', { label: 'Undo', run });
    toast.toasts()[0].action!.run();
    expect(run).toHaveBeenCalled();
  });

  it('keeps at most four toasts, dropping the oldest', () => {
    for (let i = 1; i <= 6; i++) toast.info(`Toast ${i}`);
    expect(toast.toasts().map((t) => t.message)).toEqual([
      'Toast 3',
      'Toast 4',
      'Toast 5',
      'Toast 6',
    ]);
  });

  it('dismisses on request', () => {
    const id = toast.info('Hello');
    toast.dismiss(id);
    expect(toast.toasts()).toEqual([]);
  });
});
