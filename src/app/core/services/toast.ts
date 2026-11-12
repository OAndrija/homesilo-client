import { Injectable, signal } from '@angular/core';

export interface ToastAction {
  label: string;
  run: () => void;
}

export interface Toast {
  id: number;
  message: string;
  kind: 'success' | 'info' | 'error';
  action?: ToastAction;
}

const MAX_TOASTS = 3;

/** Short confirmations at the bottom of the screen, optionally with an Undo. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private nextId = 1;
  private timers = new Map<number, ReturnType<typeof setTimeout>>();

  success(message: string, action?: ToastAction): number {
    return this.show({ message, kind: 'success', action });
  }

  info(message: string, action?: ToastAction): number {
    return this.show({ message, kind: 'info', action });
  }

  error(message: string): number {
    return this.show({ message, kind: 'error' });
  }

  dismiss(id: number): void {
    clearTimeout(this.timers.get(id));
    this.timers.delete(id);
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }

  /** Runs the toast's action (e.g. Undo) once, then closes it. */
  runAction(toast: Toast): void {
    // A double-click, or a click as it times out, must not run the action twice.
    if (!this.toasts().some((t) => t.id === toast.id)) return;
    this.dismiss(toast.id);
    toast.action?.run();
  }

  private show(toast: Omit<Toast, 'id'>): number {
    const id = this.nextId++;
    this.toasts.update((list) => [...list, { ...toast, id }].slice(-MAX_TOASTS));
    // Give people time to reach an Undo; errors stay a little longer too.
    const ms = toast.action ? 7000 : toast.kind === 'error' ? 6000 : 4000;
    this.timers.set(
      id,
      setTimeout(() => this.dismiss(id), ms),
    );
    return id;
  }
}
