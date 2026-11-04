import { exactDate, friendlyDate } from './friendly-date';

describe('friendlyDate', () => {
  const now = new Date(2026, 10, 5, 15, 30); // Nov 5, 2026, 15:30 local

  it('shows the time for today', () => {
    expect(friendlyDate(new Date(2026, 10, 5, 9, 4), now)).toMatch(/^Today, /);
  });

  it('says yesterday for the previous calendar day', () => {
    expect(friendlyDate(new Date(2026, 10, 4, 23, 59), now)).toBe('Yesterday');
    expect(friendlyDate(new Date(2026, 10, 4, 0, 0), now)).toBe('Yesterday');
  });

  it('drops the year within the current year', () => {
    const label = friendlyDate(new Date(2026, 3, 18), now);
    expect(label).toContain('18');
    expect(label).not.toContain('2026');
  });

  it('keeps the year for older dates', () => {
    expect(friendlyDate(new Date(2025, 3, 18), now)).toContain('2025');
  });

  it('handles missing and invalid values', () => {
    expect(friendlyDate(null, now)).toBe('—');
    expect(friendlyDate('not a date', now)).toBe('—');
    expect(exactDate(undefined)).toBe('');
  });

  it('accepts ISO strings', () => {
    expect(friendlyDate(new Date(2026, 10, 5, 8, 0).toISOString(), now)).toMatch(/^Today, /);
  });
});
