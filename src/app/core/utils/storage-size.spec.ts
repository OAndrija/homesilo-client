import { formatLimit, generatePassword, splitBytes, toBytes } from './storage-size';

const GB = 1024 ** 3;

describe('storage sizes', () => {
  it('converts a typed size to bytes', () => {
    expect(toBytes(100, 'GB')).toBe(100 * GB);
    expect(toBytes(1.5, 'TB')).toBe(1.5 * 1024 * GB);
    expect(toBytes(750, 'MB')).toBe(750 * 1024 ** 2);
  });

  it('picks the largest unit that shows a limit exactly', () => {
    expect(splitBytes(100 * GB)).toEqual({ value: 100, unit: 'GB' });
    expect(splitBytes(1.5 * 1024 * GB)).toEqual({ value: 1.5, unit: 'TB' });
    expect(splitBytes(3.3 * GB)).toEqual({ value: 3.3, unit: 'GB' });
    expect(splitBytes(750 * 1024 ** 2)).toEqual({ value: 750, unit: 'MB' });
  });

  it('formats limits without trailing zeros', () => {
    expect(formatLimit(100 * GB)).toBe('100 GB');
    expect(formatLimit(0)).toBe('0 MB');
  });
});

describe('generatePassword', () => {
  it('makes four groups of four unambiguous characters', () => {
    const password = generatePassword();
    expect(password).toMatch(/^[a-hj-km-np-z2-9]{4}(-[a-hj-km-np-z2-9]{4}){3}$/);
    expect(password.length).toBeGreaterThanOrEqual(8);
  });

  it('is different every time', () => {
    expect(new Set(Array.from({ length: 20 }, generatePassword)).size).toBe(20);
  });
});
