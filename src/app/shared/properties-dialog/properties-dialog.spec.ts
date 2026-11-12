import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FileMetadata } from '../../core/models/file-metadata';
import { Folder } from '../../core/models/folder';
import { PropertiesService } from '../../core/services/properties';
import { PropertiesDialog } from './properties-dialog';

const FILE: FileMetadata = {
  id: 'f1',
  originalFileName: 'beach.jpg',
  contentType: 'image/jpeg',
  size: 1536,
  trashed: false,
  starred: true,
  uploadedAt: '2026-11-01T10:00:00',
  lastModified: '2026-11-02T10:00:00',
  trashedAt: null,
  folderId: 'd2',
  folderName: 'Day 1',
  thumbnail: false,
};

const folder = (id: string, name: string): Folder => ({
  id,
  name,
  parentId: null,
  parentName: null,
  trashed: false,
  starred: false,
  trashedAt: null,
  createdAt: '2026-10-01T10:00:00',
  lastModified: '2026-10-02T10:00:00',
});

describe('PropertiesDialog', () => {
  let http: HttpTestingController;
  let properties: PropertiesService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    properties = TestBed.inject(PropertiesService);
  });

  afterEach(() => http.verify());

  it("shows a file's type, size and the folders it is in", async () => {
    const fixture = TestBed.createComponent(PropertiesDialog);
    properties.showFile(FILE);
    fixture.detectChanges();
    http.expectOne('/api/v1/files/f1/metadata').flush(FILE);
    http
      .expectOne((r) => r.url === '/api/v1/folders/d2/contents')
      .flush({
        folder: folder('d2', 'Day 1'),
        breadcrumb: [folder('d1', 'Trip'), folder('d2', 'Day 1')],
        subfolders: [],
        files: { content: [], page: 0, size: 1, totalElements: 0, totalPages: 0, last: true },
      });
    fixture.detectChanges();
    await fixture.whenStable();

    const text = fixture.nativeElement.textContent.replace(/\s+/g, ' ');
    expect(text).toContain('JPEG image');
    expect(text).toContain('1,536 bytes');
    expect(text).toContain('My Files');
    expect(text).toContain('Trip');
    expect(text).toContain('Day 1');
  });

  it('shows what a folder holds at any depth', async () => {
    const fixture = TestBed.createComponent(PropertiesDialog);
    properties.showFolder(folder('d1', 'Trip'));
    fixture.detectChanges();
    http.expectOne('/api/v1/folders/d1/summary').flush({ folders: 2, files: 1, bytes: 2048 });
    http
      .expectOne((r) => r.url === '/api/v1/folders/d1/contents')
      .flush({
        folder: folder('d1', 'Trip'),
        breadcrumb: [folder('d1', 'Trip')],
        subfolders: [],
        files: { content: [], page: 0, size: 1, totalElements: 0, totalPages: 0, last: true },
      });
    fixture.detectChanges();
    await fixture.whenStable();

    const text = fixture.nativeElement.textContent.replace(/\s+/g, ' ');
    expect(text).toContain('1 file, 2 folders');
    expect(text).toContain('2,048 bytes');
  });

  it('closes on Escape', () => {
    const fixture = TestBed.createComponent(PropertiesDialog);
    properties.showFile(FILE);
    fixture.detectChanges();
    http.expectOne('/api/v1/files/f1/metadata').flush(FILE);
    http
      .expectOne((r) => r.url === '/api/v1/folders/d2/contents')
      .flush({
        folder: null,
        breadcrumb: [],
        subfolders: [],
        files: { content: [], page: 0, size: 1, totalElements: 0, totalPages: 0, last: true },
      });
    fixture.nativeElement
      .querySelector('.dialog-backdrop')
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(properties.target()).toBeNull();
  });
});
