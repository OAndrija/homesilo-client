import { HttpErrorResponse } from '@angular/common/http';
import { errorMessage } from './http-error';

describe('errorMessage', () => {
  it('uses the problem detail from the API', () => {
    const error = new HttpErrorResponse({
      status: 409,
      error: { detail: 'Folder already exists' },
    });
    expect(errorMessage(error, 'fallback')).toBe('Folder already exists');
  });

  it('explains network failures', () => {
    expect(errorMessage(new HttpErrorResponse({ status: 0 }), 'fallback')).toContain(
      'Cannot reach',
    );
  });

  it('falls back for anything else', () => {
    expect(errorMessage(new HttpErrorResponse({ status: 500, error: 'boom' }), 'fallback')).toBe(
      'fallback',
    );
    expect(errorMessage(new Error('x'), 'fallback')).toBe('fallback');
  });
});
