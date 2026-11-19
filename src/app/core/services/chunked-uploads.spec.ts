import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ChunkedUploads, UploadStep } from './chunked-uploads';

const URL = '/api/v1/uploads';

describe('ChunkedUploads', () => {
  let chunked: ChunkedUploads;
  let http: HttpTestingController;
  /** 10 bytes in 4-byte chunks: 4 + 4 + 2. */
  const file = new File(['0123456789'], 'movie.mkv');
  const session = (received: number[] = []) => ({
    id: 's1',
    size: 10,
    chunkSize: 4,
    chunkCount: 3,
    receivedChunks: received,
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    chunked = TestBed.inject(ChunkedUploads);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  async function chunkText(index: number): Promise<string> {
    const req = http.expectOne(`${URL}/s1/chunks/${index}`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.headers.get('Content-Type')).toBe('application/octet-stream');
    const text = await (req.request.body as Blob).text();
    req.flush(null, { status: 204, statusText: 'No Content' });
    return text;
  }

  it('starts an upload, sends each chunk in turn, then completes it', async () => {
    const steps: UploadStep[] = [];
    chunked.upload(file, 'f1', null).subscribe((s) => steps.push(s));

    const start = http.expectOne(URL);
    expect(start.request.body).toEqual({ fileName: 'movie.mkv', size: 10, folderId: 'f1' });
    start.flush(session());

    expect(await chunkText(0)).toBe('0123');
    expect(await chunkText(1)).toBe('4567');
    expect(await chunkText(2)).toBe('89');
    http.expectOne(`${URL}/s1/complete`).flush({ id: 'file-1', originalFileName: 'movie.mkv' });

    expect(steps[0]).toEqual({ kind: 'started', sessionId: 's1' });
    expect(steps.filter((s) => s.kind === 'progress').at(-1)).toEqual({
      kind: 'progress',
      loaded: 10,
      total: 10,
    });
    expect(steps.at(-1)).toEqual({
      kind: 'done',
      file: { id: 'file-1', originalFileName: 'movie.mkv' },
    });
  });

  it('carries on from the chunks the server already has', async () => {
    const steps: UploadStep[] = [];
    chunked.upload(file, null, 's1').subscribe((s) => steps.push(s));
    http.expectOne(`${URL}/s1`).flush(session([0, 2]));

    expect(steps[1]).toEqual({ kind: 'progress', loaded: 6, total: 10 });
    expect(await chunkText(1)).toBe('4567');
    http.expectOne(`${URL}/s1/complete`).flush({ id: 'file-1' });
  });

  it('starts afresh if the earlier upload is gone', () => {
    chunked.upload(file, null, 'old').subscribe();
    http.expectOne(`${URL}/old`).flush({}, { status: 404, statusText: 'Not Found' });
    http.expectOne((r) => r.method === 'POST' && r.url === URL).flush(session());
    http.expectOne(`${URL}/s1/chunks/0`);
  });

  it('tries a chunk again after a dropped connection', async () => {
    vi.useFakeTimers();
    chunked.upload(file, null, null).subscribe();
    http.expectOne(URL).flush(session());

    http.expectOne(`${URL}/s1/chunks/0`).error(new ProgressEvent('error'));
    await vi.advanceTimersByTimeAsync(1000);
    http.expectOne(`${URL}/s1/chunks/0`).flush(null, { status: 204, statusText: 'No Content' });
    http.expectOne(`${URL}/s1/chunks/1`);
  });

  it("doesn't retry a chunk the server refuses", () => {
    let failed = false;
    chunked.upload(file, null, null).subscribe({ error: () => (failed = true) });
    http.expectOne(URL).flush(session());
    http
      .expectOne(`${URL}/s1/chunks/0`)
      .flush({ detail: 'wrong size' }, { status: 400, statusText: 'Bad Request' });
    expect(failed).toBe(true);
  });

  it('cancels on the server', () => {
    chunked.cancel('s1');
    expect(http.expectOne(`${URL}/s1`).request.method).toBe('DELETE');
  });
});
