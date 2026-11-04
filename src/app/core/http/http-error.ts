import { HttpErrorResponse } from '@angular/common/http';

/**
 * Extracts a user-facing message from a failed request. The API returns RFC 9457
 * problem details (`{ detail, status, ... }`); anything else falls back.
 */
export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) return 'Cannot reach the server. Check your connection.';
    const detail = (error.error as { detail?: unknown } | null)?.detail;
    if (typeof detail === 'string' && detail.trim()) return detail;
  }
  return fallback;
}
