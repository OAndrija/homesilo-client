import { computed, signal } from '@angular/core';

/**
 * Undo and redo over snapshots of some state. `record` is called whenever a
 * change is finished; a record equal to the current state is ignored, so
 * calling it after every action is safe.
 */
export class UndoHistory<T> {
  private readonly past = signal<T[]>([]);
  private readonly future = signal<T[]>([]);
  private current: T;

  readonly canUndo = computed(() => this.past().length > 0);
  readonly canRedo = computed(() => this.future().length > 0);

  constructor(
    initial: T,
    private readonly same: (a: T, b: T) => boolean,
    private readonly limit = 100,
  ) {
    this.current = initial;
  }

  /** Starts over from this state, with nothing to undo or redo. */
  reset(state: T): void {
    this.past.set([]);
    this.future.set([]);
    this.current = state;
  }

  /** Makes this state one step; returns whether it was a change. */
  record(state: T): boolean {
    if (this.same(state, this.current)) return false;
    const before = this.current;
    this.past.update((p) => [...p, before].slice(-this.limit));
    this.future.set([]);
    this.current = state;
    return true;
  }

  /** The state before the last step, or null when there is none. */
  undo(): T | null {
    const past = this.past();
    if (!past.length) return null;
    const previous = past[past.length - 1];
    this.past.set(past.slice(0, -1));
    this.future.update((f) => [this.current, ...f]);
    this.current = previous;
    return previous;
  }

  /** The state that was undone last, or null when there is none. */
  redo(): T | null {
    const [next, ...rest] = this.future();
    if (next === undefined) return null;
    this.future.set(rest);
    this.past.update((p) => [...p, this.current]);
    this.current = next;
    return next;
  }
}
