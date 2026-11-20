import { HttpClient, HttpErrorResponse, HttpEventType } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  catchError,
  concat,
  concatMap,
  defer,
  filter,
  from,
  map,
  Observable,
  of,
  retry,
  switchMap,
  throwError,
  timer,
} from 'rxjs';
import { API_BASE } from '../api';
import { FileMetadata } from '../models/file-metadata';

const URL = `${API_BASE}/uploads`;

/**
 * Files bigger than this go in chunks. Smaller ones are a single request, which
 * is quicker; this is also comfortably under the 100 MB a proxy in front
 * (Cloudflare's free plan) may allow per request.
 */
export const CHUNKED_ABOVE = 32 * 1024 * 1024;

/** Tries per chunk on a network blip or a busy server, waiting 1, 2, then 4 seconds. */
const CHUNK_TRIES = 4;

interface UploadSession {
  id: string;
  size: number;
  chunkSize: number;
  chunkCount: number;
  receivedChunks: number[];
}

export type UploadStep =
  | { kind: 'started'; sessionId: string }
  | { kind: 'progress'; loaded: number; total: number }
  | { kind: 'done'; file: FileMetadata };

/**
 * Sends one file in chunks: starts (or picks up) an upload session, sends the
 * chunks the server doesn't have yet one by one, then completes it. Given the id
 * of an earlier attempt, it carries on from where that one stopped.
 */
@Injectable({ providedIn: 'root' })
export class ChunkedUploads {
  private http = inject(HttpClient);

  upload(file: File, folderId: string | null, resumeId: string | null): Observable<UploadStep> {
    return this.session(file, folderId, resumeId).pipe(
      switchMap((session) => {
        const received = new Set(session.receivedChunks);
        const missing = Array.from({ length: session.chunkCount }, (_, i) => i).filter(
          (i) => !received.has(i),
        );
        let sent = session.receivedChunks.reduce(
          (sum, i) => sum + chunkOf(file, session, i).size,
          0,
        );
        return concat(
          of<UploadStep>({ kind: 'started', sessionId: session.id }),
          of<UploadStep>({ kind: 'progress', loaded: sent, total: file.size }),
          from(missing).pipe(
            concatMap((index) => {
              const chunk = chunkOf(file, session, index);
              return this.sendChunk(session.id, index, chunk).pipe(
                map((loaded): UploadStep => {
                  if (loaded === null) {
                    sent += chunk.size;
                    return { kind: 'progress', loaded: sent, total: file.size };
                  }
                  return { kind: 'progress', loaded: sent + loaded, total: file.size };
                }),
              );
            }),
          ),
          defer(() => this.http.post<FileMetadata>(`${URL}/${session.id}/complete`, {})).pipe(
            map((stored): UploadStep => ({ kind: 'done', file: stored })),
          ),
        );
      }),
    );
  }

  /** Stops an upload for good; the server throws away what it has. */
  cancel(sessionId: string): void {
    this.http.delete(`${URL}/${sessionId}`).subscribe({ error: () => undefined });
  }

  /** Picks up an earlier attempt if the server still has it, else starts afresh. */
  private session(
    file: File,
    folderId: string | null,
    resumeId: string | null,
  ): Observable<UploadSession> {
    const start = defer(() =>
      this.http.post<UploadSession>(URL, { fileName: file.name, size: file.size, folderId }),
    );
    if (!resumeId) return start;
    return this.http
      .get<UploadSession>(`${URL}/${resumeId}`)
      .pipe(
        catchError((err: HttpErrorResponse) =>
          err.status === 404 ? start : throwError(() => err),
        ),
      );
  }

  /** Emits bytes sent so far within the chunk, then null once the server has it. */
  private sendChunk(sessionId: string, index: number, chunk: Blob): Observable<number | null> {
    return defer(() =>
      this.http.put(`${URL}/${sessionId}/chunks/${index}`, chunk, {
        headers: { 'Content-Type': 'application/octet-stream' },
        observe: 'events',
        reportProgress: true,
      }),
    ).pipe(
      filter((e) => e.type === HttpEventType.UploadProgress || e.type === HttpEventType.Response),
      map((e) => (e.type === HttpEventType.UploadProgress ? e.loaded : null)),
      retry({
        count: CHUNK_TRIES - 1,
        delay: (err: HttpErrorResponse, attempt) =>
          worthRetrying(err) ? timer(1000 * 2 ** (attempt - 1)) : throwError(() => err),
      }),
    );
  }
}

function chunkOf(file: File, session: UploadSession, index: number): Blob {
  const start = index * session.chunkSize;
  return file.slice(start, Math.min(file.size, start + session.chunkSize));
}

/** The connection dropped, or the server was briefly busy; not a refusal. */
function worthRetrying(err: HttpErrorResponse): boolean {
  return err.status === 0 || err.status === 408 || err.status === 429 || err.status >= 500;
}
