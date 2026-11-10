import { nameProblem } from './folder-name-dialog';

describe('nameProblem', () => {
  it('accepts ordinary names', () => {
    expect(nameProblem('Holiday photos 2026')).toBeNull();
    expect(nameProblem('notes.md')).toBeNull();
  });

  it('rejects slashes, reserved names and very long names', () => {
    expect(nameProblem('a/b')).toContain('/');
    expect(nameProblem('a\\b')).toContain('/');
    expect(nameProblem('..')).toBe('That name is reserved');
    expect(nameProblem('x'.repeat(256))).toBe('Use 255 characters or fewer');
  });
});
