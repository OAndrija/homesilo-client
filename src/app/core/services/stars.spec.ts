import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { FileMetadata } from '../models/file-metadata';
import { Folder } from '../models/folder';
import { allStarred, StarChange, Stars } from './stars';

function file(id: string, starred: boolean): FileMetadata {
  return {
    id,
    originalFileName: `${id}.txt`,
    contentType: 'text/plain',
    size: 1,
    trashed: false,
    starred,
    uploadedAt: '',
    lastModified: '',
    trashedAt: null,
    folderId: null,
    folderName: null,
    thumbnail: false,
  };
}

function folder(id: string, starred: boolean): Folder {
  return {
    id,
    name: id,
    parentId: null,
    parentName: null,
    trashed: false,
    starred,
    trashedAt: null,
    createdAt: '',
    lastModified: '',
  };
}

describe('allStarred', () => {
  it('is true only when there is a selection and all of it is starred', () => {
    expect(allStarred([], [])).toBe(false);
    expect(allStarred([file('a', true)], [folder('f', true)])).toBe(true);
    expect(allStarred([file('a', true)], [folder('f', false)])).toBe(false);
  });
});

describe('Stars.toggleAll', () => {
  let stars: Stars;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    stars = TestBed.inject(Stars);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('stars only the items that are not starred yet when the selection is mixed', () => {
    let result: StarChange | undefined;
    stars
      .toggleAll([file('a', true), file('b', false)], [folder('f', false)])
      .subscribe((change) => (result = change));

    http.expectOne('/api/v1/files/b/star').flush(file('b', true));
    http.expectOne('/api/v1/folders/f/star').flush(folder('f', true));

    expect(result?.starred).toBe(true);
    expect(result?.files.map((f) => f.id)).toEqual(['b']);
    expect(result?.folders.map((f) => f.id)).toEqual(['f']);
  });

  it('unstars everything when the whole selection is already starred', () => {
    let result: StarChange | undefined;
    stars
      .toggleAll([file('a', true)], [folder('f', true)])
      .subscribe((change) => (result = change));

    http.expectOne('/api/v1/files/a/star').flush(file('a', false));
    http.expectOne('/api/v1/folders/f/star').flush(folder('f', false));

    expect(result?.starred).toBe(false);
  });
});
