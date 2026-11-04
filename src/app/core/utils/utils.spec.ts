import { getFileIcon } from './file-icon.util';
import { isPreviewable } from './file-preview.utils';
import { formatBytes } from './format';

describe('formatBytes', () => {
  it.each([
    [0, '0 B'],
    [512, '512 B'],
    [1536, '1.5 KB'],
    [5 * 1024 ** 2, '5.0 MB'],
    [1.25 * 1024 ** 3, '1.25 GB'],
    [-1, '0 B'],
  ])('%d bytes → %s', (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected);
  });
});

describe('isPreviewable', () => {
  it('accepts media, text and PDF', () => {
    expect(isPreviewable('image/png')).toBe(true);
    expect(isPreviewable('video/mp4')).toBe(true);
    expect(isPreviewable('application/pdf')).toBe(true);
    expect(isPreviewable('TEXT/PLAIN')).toBe(true);
  });

  it('rejects everything else', () => {
    expect(isPreviewable('application/zip')).toBe(false);
    expect(isPreviewable(null)).toBe(false);
  });
});

describe('getFileIcon', () => {
  it('maps by extension, case-insensitively', () => {
    expect(getFileIcon('Report.PDF').icon).toBe('picture_as_pdf');
    expect(getFileIcon('no-extension').icon).toBe('draft');
  });
});
