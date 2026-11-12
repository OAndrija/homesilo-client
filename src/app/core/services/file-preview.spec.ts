import { TestBed } from '@angular/core/testing';
import { FileMetadata } from '../models/file-metadata';
import { FilePreviewService, previewKind } from './file-preview';

function file(id: string): FileMetadata {
  return {
    id,
    originalFileName: `${id}.txt`,
    contentType: 'text/plain',
    size: 1,
    trashed: false,
    starred: false,
    uploadedAt: '',
    lastModified: '',
    trashedAt: null,
    folderId: null,
    folderName: null,
    thumbnail: false,
  };
}

describe('previewKind', () => {
  it('maps content types to the way the viewer shows them', () => {
    expect(previewKind('image/png')).toBe('image');
    expect(previewKind('VIDEO/MP4')).toBe('video');
    expect(previewKind('audio/mpeg')).toBe('audio');
    expect(previewKind('application/pdf')).toBe('pdf');
    expect(previewKind('text/markdown')).toBe('text');
    expect(previewKind('application/json')).toBe('text');
    expect(previewKind('application/zip')).toBe('none');
    expect(previewKind(null)).toBe('none');
  });

  it('never renders SVG as an image, since it can carry script', () => {
    expect(previewKind('image/svg+xml')).toBe('text');
  });
});

describe('FilePreviewService', () => {
  const list = [file('a'), file('b'), file('c')];
  let preview: FilePreviewService;

  beforeEach(() => (preview = TestBed.inject(FilePreviewService)));

  it('opens on the clicked file within its list', () => {
    preview.show(list[1], list);
    expect(preview.isOpen()).toBe(true);
    expect(preview.current()?.id).toBe('b');
    expect(preview.index()).toBe(1);
    expect(preview.count()).toBe(3);
  });

  it('steps through the list and stops at either end', () => {
    preview.show(list[0], list);
    expect(preview.hasPrevious()).toBe(false);
    preview.previous();
    expect(preview.current()?.id).toBe('a');
    preview.next();
    preview.next();
    expect(preview.current()?.id).toBe('c');
    expect(preview.hasNext()).toBe(false);
    preview.next();
    expect(preview.current()?.id).toBe('c');
  });

  it('falls back to the single file when it is not in the given list', () => {
    const stray = file('z');
    preview.show(stray, list);
    expect(preview.count()).toBe(1);
    expect(preview.current()?.id).toBe('z');
  });

  it('closes', () => {
    preview.show(list[0], list);
    preview.close();
    expect(preview.isOpen()).toBe(false);
    expect(preview.current()).toBeNull();
  });
});
