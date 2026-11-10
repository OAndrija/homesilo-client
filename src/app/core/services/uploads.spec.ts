import { HttpEventType, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DashboardStore } from './dashboard-store';
import { UploadService } from './uploads';

describe('UploadService', () => {
  let uploads: UploadService;
  let http: HttpTestingController;
  const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve));

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: DashboardStore, useValue: { refresh: vi.fn() } },
      ],
    });
    uploads = TestBed.inject(UploadService);
    http = TestBed.inject(HttpTestingController);
  });

  const file = (name: string) => new File(['x'.repeat(10)], name);

  it('uploads one file at a time, reporting progress, and announces each result', async () => {
    const done: string[] = [];
    uploads.uploaded.subscribe(({ file }) => done.push(file.originalFileName));
    uploads.enqueue([file('a.txt'), file('b.txt')], 'folder-1');

    expect(uploads.items().map((i) => i.status)).toEqual(['uploading', 'queued']);
    const first = http.expectOne('/api/v1/files/upload');
    expect((first.request.body as FormData).get('folderId')).toBe('folder-1');

    first.event({ type: HttpEventType.UploadProgress, loaded: 5, total: 10 });
    expect(uploads.items()[0].progress).toBe(50);

    first.flush({ id: '1', originalFileName: 'a.txt' });
    await flushMicrotasks();
    expect(uploads.items()[0].status).toBe('done');
    expect(uploads.items()[1].status).toBe('uploading');

    http.expectOne('/api/v1/files/upload').flush({ id: '2', originalFileName: 'b.txt' });
    await flushMicrotasks();
    expect(done).toEqual(['a.txt', 'b.txt']);
    expect(uploads.active()).toBe(false);
    expect(uploads.doneCount()).toBe(2);
  });

  it('keeps going after a failure, and can retry the failed file', async () => {
    uploads.enqueue([file('bad.txt'), file('ok.txt')], null);
    http
      .expectOne('/api/v1/files/upload')
      .flush({ detail: 'Storage quota exceeded' }, { status: 413, statusText: 'Too Large' });
    await flushMicrotasks();
    expect(uploads.items()[0].status).toBe('error');
    expect(uploads.items()[0].error).toBe('Storage quota exceeded');

    http.expectOne('/api/v1/files/upload').flush({ id: '2', originalFileName: 'ok.txt' });
    await flushMicrotasks();
    expect(uploads.failedCount()).toBe(1);

    uploads.retry(uploads.items()[0].id);
    expect(uploads.items()[0].status).toBe('uploading');
    http.expectOne('/api/v1/files/upload').flush({ id: '1', originalFileName: 'bad.txt' });
    await flushMicrotasks();
    expect(uploads.failedCount()).toBe(0);
  });

  it('cancels the current upload and moves on', async () => {
    uploads.enqueue([file('big.mov'), file('next.txt')], null);
    const big = http.expectOne('/api/v1/files/upload');
    uploads.cancel(uploads.items()[0].id);
    expect(big.cancelled).toBe(true);
    expect(uploads.items()[0].status).toBe('cancelled');
    http.expectOne('/api/v1/files/upload').flush({ id: '2', originalFileName: 'next.txt' });
    await flushMicrotasks();
    expect(uploads.items()[1].status).toBe('done');
  });

  it('only clears the panel once nothing is uploading', async () => {
    uploads.enqueue([file('a.txt')], null);
    uploads.dismiss();
    expect(uploads.items().length).toBe(1);
    http.expectOne('/api/v1/files/upload').flush({ id: '1', originalFileName: 'a.txt' });
    await flushMicrotasks();
    uploads.dismiss();
    expect(uploads.items()).toEqual([]);
  });
});
