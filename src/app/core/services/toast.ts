import { Injectable, signal } from '@angular/core';

export type ToastKind = 'info' | 'success' | 'error' | 'progress';

export interface ToastAction {
  label: string;
  run: () => void;
}

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  action?: ToastAction;
}

const DURATION_MS: Record<ToastKind, number> = {
  info: 4000,
  success: 4000,
  error: 7000,
  progress: 0, // stays until updated or dismissed
};

/**
 * App-wide, non-blocking feedback. Toasts never shift the layout, and an
 * optional action (like Undo) makes destructive steps forgiving.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  private timers = new Map<number, ReturnType<typeof setTimeout>>();
  private readonly items = signal<Toast[]>([]);
  readonly toasts = this.items.asReadonly();

  success(message: string, action?: ToastAction): number {
    return this.show('success', message, action);
  }

  info(message: string, action?: ToastAction): number {
    return this.show('info', message, action);
  }

  error(message: string): number {
    return this.show('error', message);
  }

  /** A persistent toast for long-running work; update it, then finish with another kind. */
  progress(message: string): number {
    return this.show('progress', message);
  }

  update(id: number, kind: ToastKind, message: string, action?: ToastAction): void {
    if (!this.items().some((t) => t.id === id)) {
      this.show(kind, message, action);
      return;
    }
    this.items.update((list) => list.map((t) => (t.id === id ? { id, kind, message, action } : t)));
    this.schedule(id, kind);
  }

  dismiss(id: number): void {
    clearTimeout(this.timers.get(id));
    this.timers.delete(id);
    this.items.update((list) => list.filter((t) => t.id !== id));
  }

  private show(kind: ToastKind, message: string, action?: ToastAction): number {
    const id = this.nextId++;
    // Keep the stack short: the oldest finished toast makes room.
    this.items.update((list) => [...list.slice(-3), { id, kind, message, action }]);
    this.schedule(id, kind);
    return id;
  }

  private schedule(id: number, kind: ToastKind): void {
    clearTimeout(this.timers.get(id));
    const duration = DURATION_MS[kind];
    if (duration > 0)
      this.timers.set(
        id,
        setTimeout(() => this.dismiss(id), duration),
      );
  }
}
