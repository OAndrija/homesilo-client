import { friendlyDate } from './friendly-date';

// Angular's locale data puts a narrow no-break space before AM/PM, which \s matches.

describe('friendlyDate', () => {
  const now = new Date(2026, 10, 8, 15, 30); // Nov 8, 2026, 3:30 PM local

  it('shows the time for today and yesterday', () => {
    expect(friendlyDate(new Date(2026, 10, 8, 9, 5), 'en-US', now)).toMatch(/^Today, 9:05\sAM$/);
    expect(friendlyDate(new Date(2026, 10, 7, 23, 59), 'en-US', now)).toMatch(
      /^Yesterday, 11:59\sPM$/,
    );
  });

  it('drops the year within the current year', () => {
    expect(friendlyDate(new Date(2026, 3, 18), 'en-US', now)).toBe('Apr 18');
  });

  it('keeps the year for older dates', () => {
    expect(friendlyDate(new Date(2025, 3, 18), 'en-US', now)).toBe('Apr 18, 2025');
  });

  it('accepts ISO strings and handles missing or invalid values', () => {
    expect(friendlyDate(new Date(2026, 10, 8, 8, 0).toISOString(), 'en-US', now)).toMatch(
      /^Today, 8:00\sAM$/,
    );
    expect(friendlyDate(null, 'en-US', now)).toBe('—');
    expect(friendlyDate('not a date', 'en-US', now)).toBe('—');
  });
});
