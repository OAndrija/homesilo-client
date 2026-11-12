import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { FileMetadata } from '../models/file-metadata';
import { Folder } from '../models/folder';
import { FileActions } from './file-actions';
import { FilePreviewService } from './file-preview';

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
    thumbnail: false,
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

  it('opens the in-app viewer on the file, within the list it came from', () => {
    const preview = TestBed.inject(FilePreviewService);
    const list = [file('a', 'image/png'), file('z', 'application/zip')];
    actions.open(list[1], list);
    expect(preview.current()?.id).toBe('z');
    expect(preview.count()).toBe(2);
  });
});
