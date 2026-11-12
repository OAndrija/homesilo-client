import { describeKind } from './file-kind';

describe('describeKind', () => {
  it('names common types', () => {
    expect(describeKind('beach.jpg', 'image/jpeg')).toBe('JPEG image');
    expect(
      describeKind(
        'cv.docx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ),
    ).toBe('Word document');
    expect(describeKind('notes.txt', 'text/plain; charset=UTF-8')).toBe('Plain text');
  });

  it('falls back to the family and extension', () => {
    expect(describeKind('clip.mkv', 'video/x-unknown')).toBe('MKV video');
    expect(describeKind('raw.cr3', 'application/octet-stream')).toBe('CR3 file');
    expect(describeKind('README', 'application/octet-stream')).toBe('File');
  });
});
