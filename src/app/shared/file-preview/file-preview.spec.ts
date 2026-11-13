import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FileMetadata } from '../../core/models/file-metadata';
import { FilePreviewService } from '../../core/services/file-preview';
import { PropertiesService } from '../../core/services/properties';
import { FilePreview } from './file-preview';

const FILE: FileMetadata = {
  id: 'f1',
  originalFileName: 'beach.jpg',
  contentType: 'image/jpeg',
  size: 1536,
  trashed: false,
  starred: false,
  uploadedAt: '2026-11-01T10:00:00',
  lastModified: '2026-11-02T10:00:00',
  trashedAt: null,
  folderId: null,
  folderName: null,
  thumbnail: true,
};

describe('FilePreview details', () => {
  let http: HttpTestingController;
  let preview: FilePreviewService;

  beforeEach(() => {
    try {
      localStorage.removeItem('hs-viewer-details');
    } catch {
      // No storage in this environment.
    }
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    preview = TestBed.inject(FilePreviewService);
  });

  afterEach(() => http.verify());

  function openDetails() {
    const fixture = TestBed.createComponent(FilePreview);
    preview.show(FILE);
    fixture.detectChanges();
    const info = fixture.nativeElement.querySelector('button[aria-pressed]') as HTMLButtonElement;
    info.click();
    fixture.detectChanges();
    http.expectOne('/api/v1/files/f1/metadata').flush(FILE);
    fixture.detectChanges();
    return { fixture, info };
  }

  it('shows the details beside the file, not the properties dialog', () => {
    const { fixture, info } = openDetails();
    const aside = fixture.nativeElement.querySelector('aside.details') as HTMLElement;

    expect(aside).not.toBeNull();
    expect(info.getAttribute('aria-pressed')).toBe('true');
    expect(TestBed.inject(PropertiesService).target()).toBeNull();
    expect(aside.textContent).toContain('JPEG image');
  });

  it('has no Open or Download buttons and no Preview row in the details', () => {
    const { fixture } = openDetails();
    const aside = fixture.nativeElement.querySelector('aside.details') as HTMLElement;
    const labels = [...aside.querySelectorAll('button')].map((b) =>
      (b.getAttribute('aria-label') ?? b.textContent ?? '').trim(),
    );

    expect(labels.some((l) => /^(open|download)/i.test(l))).toBe(false);
    expect(aside.textContent).not.toContain('Preview');
  });

  it('closes the details with the I key', () => {
    const { fixture } = openDetails();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'i' }));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('aside.details')).toBeNull();
  });
});
