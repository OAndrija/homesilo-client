import { Component, inject } from '@angular/core';
import { FloatingBars } from '../../core/services/floating-bars';
import { ToastService } from '../../core/services/toast';

@Component({
  selector: 'app-toast-host',
  templateUrl: './toast-host.html',
  styleUrl: './toast-host.css',
})
export class ToastHost {
  protected toastService = inject(ToastService);
  protected bars = inject(FloatingBars);

  readonly icons = { success: 'check_circle', info: 'info', error: 'error' } as const;
}
