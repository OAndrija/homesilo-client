import { inject, Injectable } from '@angular/core';
import { concatMap, from, map, Observable, toArray } from 'rxjs';
import { FileMetadata } from '../models/file-metadata';
import { Folder } from '../models/folder';
import { Files } from './files';
import { Folders } from './folders';

export interface StarChange {
  /** What the items are now: all starred, or all unstarred. */
  starred: boolean;
  files: FileMetadata[];
  folders: Folder[];
}

/** True when there is a selection and every item in it is starred. */
export function allStarred(files: FileMetadata[], folders: Folder[]): boolean {
  const items = [...files, ...folders];
  return items.length > 0 && items.every((item) => item.starred);
}

/**
 * Starring a selection works like a toggle for the whole group: if everything is
 * already starred it unstars them all, otherwise it stars the rest. Only the items
 * that actually change are sent, one at a time.
 */
@Injectable({ providedIn: 'root' })
export class Stars {
  private files = inject(Files);
  private folders = inject(Folders);

  toggleAll(files: FileMetadata[], folders: Folder[]): Observable<StarChange> {
    const starred = !allStarred(files, folders);
    const files$ = from(files.filter((f) => f.starred !== starred)).pipe(
      concatMap((f) => this.files.toggleStar(f.id)),
      toArray(),
    );
    const folders$ = from(folders.filter((f) => f.starred !== starred)).pipe(
      concatMap((f) => this.folders.toggleStar(f.id)),
      toArray(),
    );
    return files$.pipe(
      concatMap((updatedFiles) =>
        folders$.pipe(
          map((updatedFolders) => ({ starred, files: updatedFiles, folders: updatedFolders })),
        ),
      ),
    );
  }
}
