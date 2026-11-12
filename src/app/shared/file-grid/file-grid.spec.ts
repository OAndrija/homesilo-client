import { provideHttpClient } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FileMetadata } from '../../core/models/file-metadata';
import { FileGrid } from './file-grid';

function file(id: string, thumbnail = false): FileMetadata {
  return {
    id,
    originalFileName: `${id}.jpg`,
    contentType: 'image/jpeg',
    size: 10,
    trashed: false,
    starred: false,
    uploadedAt: '2026-11-01T10:00:00',
    lastModified: '2026-11-01T10:00:00',
    trashedAt: null,
    folderId: null,
    folderName: null,
    thumbnail,
  };
}

function click(modifiers: Partial<MouseEventInit> = {}): MouseEvent {
  return new MouseEvent('click', modifiers);
}

describe('FileGrid', () => {
  let fixture: ComponentFixture<FileGrid>;
  let grid: FileGrid;
  const files = [file('a', true), file('b'), file('c'), file('d')];

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient()] });
    fixture = TestBed.createComponent(FileGrid);
    fixture.componentRef.setInput('files', files);
    grid = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('selects one tile on click, adds with Ctrl and a range with Shift', () => {
    grid.onFileClick(files[0], 0, click());
    expect([...grid.selectedIds()]).toEqual(['a']);

    grid.onFileClick(files[2], 2, click({ ctrlKey: true }));
    expect([...grid.selectedIds()].sort()).toEqual(['a', 'c']);

    grid.onFileClick(files[3], 3, click({ shiftKey: true }));
    expect([...grid.selectedIds()].sort()).toEqual(['a', 'c', 'd']);

    grid.clearSelection();
    expect(grid.selectedCount()).toBe(0);
  });

  it('opens with Enter and toggles the selection with Space', () => {
    const opened: string[] = [];
    grid.openFile.subscribe((f) => opened.push(f.id));
    const tile = document.createElement('div');
    const key = (k: string) => {
      const event = new KeyboardEvent('keydown', { key: k });
      Object.defineProperty(event, 'target', { value: tile });
      Object.defineProperty(event, 'currentTarget', { value: tile });
      return event;
    };

    grid.onFileKeydown(files[1], 1, key('Enter'));
    expect(opened).toEqual(['b']);

    grid.onFileKeydown(files[1], 1, key(' '));
    expect(grid.isSelected('b')).toBe(true);
    grid.onFileKeydown(files[1], 1, key(' '));
    expect(grid.isSelected('b')).toBe(false);
  });

  it('shows a preview only for files that have one, and falls back after an error', () => {
    expect(grid.thumbnailUrl(files[0])).toBe('/api/v1/files/a/thumbnail');
    expect(grid.thumbnailUrl(files[1])).toBeNull();

    grid.onThumbError(files[0]);
    expect(grid.thumbnailUrl(files[0])).toBeNull();
  });

  it('forgets selected files that are no longer shown', () => {
    grid.onFileClick(files[0], 0, click());
    fixture.componentRef.setInput('files', files.slice(1));
    fixture.detectChanges();
    expect(grid.selectedCount()).toBe(0);
  });

  it('sends menu actions to the matching output', () => {
    const starred: string[] = [];
    grid.star.subscribe((f) => starred.push(f.id));
    grid.run('star', { kind: 'file', item: files[2] });
    expect(starred).toEqual(['c']);
  });
});
