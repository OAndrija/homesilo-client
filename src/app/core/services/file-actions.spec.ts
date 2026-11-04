import { DOCUMENT } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { FileMetadata } from '../models/file-metadata';
import { Folder } from '../models/folder';
import { FileActions } from './file-actions';

function file(id: string, contentType = 'text/plain'): FileMetadata {
  return {
    id,
    originalFileName: `${id}.txt`,
    contentType,
    size: 1,
    trashed: false,
    starred: false,
    uploadedAt: '',
    lastModified: '',
    trashedAt: null,
    folderId: null,
    folderName: null,
  };
}

describe('FileActions', () => {
  let actions: FileActions;
  let clicked: string[];

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient()] });
    actions = TestBed.inject(FileActions);
    clicked = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicked.push(this.getAttribute('href') ?? '');
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it('downloads a single file directly', () => {
    actions.downloadSelection([file('a')]);
    expect(clicked).toEqual(['/api/v1/files/a/download']);
  });

  it('zips several files and any folders', () => {
    const folder = { id: 'f1' } as Folder;
    actions.downloadSelection([file('a'), file('b')], [folder]);
    expect(clicked[0]).toBe('/api/v1/files/download-zip?fileIds=a&fileIds=b&folderIds=f1');
  });

  it('refuses to preview unsupported types', () => {
    const open = vi.spyOn(TestBed.inject(DOCUMENT).defaultView!, 'open').mockReturnValue(null);
    expect(actions.open(file('z', 'application/zip'))).toBe(false);
    expect(open).not.toHaveBeenCalled();

    expect(actions.open(file('p', 'application/pdf'))).toBe(true);
    expect(open).toHaveBeenCalledWith('/api/v1/files/p/preview', '_blank', 'noopener');
  });
});
