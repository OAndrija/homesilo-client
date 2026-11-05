import { Component, inject } from '@angular/core';
import { Toast, ToastService } from '../../core/services/toast';

const ICONS: Record<Toast['kind'], string> = {
  info: 'info',
  success: 'check_circle',
  error: 'error',
  progress: 'progress_activity',
};

@Component({
  selector: 'app-toast-host',
  template: `
    <div class="toast-stack" aria-live="polite" aria-relevant="additions text">
      @for (toast of toastService.toasts(); track toast.id) {
        <div
          [class]="'toast is-' + toast.kind"
          [attr.role]="toast.kind === 'error' ? 'alert' : 'status'"
        >
          @if (toast.kind === 'progress') {
            <span class="spinner" aria-hidden="true"></span>
          } @else {
            <span class="material-symbols-rounded toast-icon" aria-hidden="true">{{
              icon(toast)
            }}</span>
          }
          <span class="toast-message">{{ toast.message }}</span>
          @if (toast.action; as action) {
            <button class="toast-action" type="button" (click)="act(toast)">
              {{ action.label }}
            </button>
          }
          @if (toast.kind !== 'progress') {
            <button
              class="icon-btn toast-close"
              type="button"
              aria-label="Dismiss"
              (click)="toastService.dismiss(toast.id)"
            >
              <span class="material-symbols-rounded">close</span>
            </button>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .toast-stack {
      position: fixed;
      left: 24px;
      bottom: 24px;
      z-index: 200;
      display: flex;
      flex-direction: column;
      gap: 8px;
      width: min(400px, calc(100vw - 32px));
      pointer-events: none;
    }
    .toast {
      display: flex;
      align-items: center;
      gap: 10px;
      min-height: 48px;
      padding: 8px 8px 8px 14px;
      background: var(--frost);
      color: var(--night);
      border-radius: var(--radius-panel);
      box-shadow: var(--shadow-pop);
      font-size: var(--text-md);
      pointer-events: auto;
      animation: toast-in 0.18s ease;
    }
    .toast-icon {
      font-size: 20px;
    }
    .toast-message {
      flex: 1;
      min-width: 0;
      overflow-wrap: anywhere;
    }
    .toast-action {
      padding: 6px 10px;
      border-radius: var(--radius-control);
      color: #8a5a0b; /* amber that reads on the light toast */
      font-weight: 650;
    }
    :host-context([data-theme='light']) .toast-action {
      color: #f0b04a;
    }
    .toast.is-success .toast-icon {
      color: #15935a;
    }
    .toast.is-error .toast-icon {
      color: #d23c4a;
    }
    :host-context([data-theme='light']) .toast.is-success .toast-icon {
      color: #3ccb7f;
    }
    :host-context([data-theme='light']) .toast.is-error .toast-icon {
      color: #f0616d;
    }
    .toast-action:hover {
      background: color-mix(in srgb, var(--night) 8%, transparent);
    }
    .toast-close {
      width: 30px;
      height: 30px;
      color: color-mix(in srgb, var(--night) 60%, transparent);
    }
    .toast-close:hover {
      background: color-mix(in srgb, var(--night) 8%, transparent);
      color: var(--night);
    }
    @keyframes toast-in {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
    }
    @media (max-width: 720px) {
      .toast-stack {
        left: 16px;
        bottom: 16px;
      }
    }
  `,
})
export class ToastHost {
  protected toastService = inject(ToastService);

  protected icon(toast: Toast): string {
    return ICONS[toast.kind];
  }

  protected act(toast: Toast): void {
    toast.action?.run();
    this.toastService.dismiss(toast.id);
  }
}
