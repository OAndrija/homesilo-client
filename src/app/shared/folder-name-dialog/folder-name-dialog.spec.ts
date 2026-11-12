import { fileExtension, nameProblem, withExtension } from './folder-name-dialog';

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

describe('fileExtension', () => {
  it('reads the text after the last dot', () => {
    expect(fileExtension('aca.pdf')).toBe('pdf');
    expect(fileExtension('archive.tar.gz')).toBe('gz');
  });

  it('treats dot-files and names without a dot as having no extension', () => {
    expect(fileExtension('README')).toBe('');
    expect(fileExtension('.env')).toBe('');
    expect(fileExtension('trailing.')).toBe('');
  });
});

describe('withExtension', () => {
  it('adds the fixed extension to the edited name', () => {
    expect(withExtension(' summary ', 'pdf')).toBe('summary.pdf');
  });

  it("doesn't double an extension typed out of habit", () => {
    expect(withExtension('summary.pdf', 'pdf')).toBe('summary.pdf');
    expect(withExtension('summary.PDF', 'pdf')).toBe('summary.PDF');
  });

  it('keeps a different typed extension as part of the name', () => {
    expect(withExtension('aca.i', 'pdf')).toBe('aca.i.pdf');
  });

  it('leaves names alone when there is no extension', () => {
    expect(withExtension('notes', '')).toBe('notes');
  });
});
