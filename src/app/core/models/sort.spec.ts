import { Folder } from './folder';
import { fileSortParam, nextSort, sortFolders } from './sort';

function folder(name: string, lastModified: string, trashedAt: string | null = null): Folder {
  return { id: name, name, lastModified, trashedAt } as Folder;
}

describe('sorting', () => {
  it('maps a column to the server property, including the trash date', () => {
    expect(fileSortParam({ key: 'name', direction: 'asc' })).toBe('originalFileName,asc');
    expect(fileSortParam({ key: 'size', direction: 'desc' })).toBe('size,desc');
    expect(fileSortParam({ key: 'date', direction: 'desc' })).toBe('lastModified,desc');
    expect(fileSortParam({ key: 'date', direction: 'asc' }, 'trashedAt')).toBe('trashedAt,asc');
  });

  it('flips direction on the same column and starts new columns in their natural order', () => {
    expect(nextSort({ key: 'date', direction: 'desc' }, 'date')).toEqual({
      key: 'date',
      direction: 'asc',
    });
    expect(nextSort({ key: 'date', direction: 'desc' }, 'name')).toEqual({
      key: 'name',
      direction: 'asc',
    });
    expect(nextSort({ key: 'name', direction: 'asc' }, 'size')).toEqual({
      key: 'size',
      direction: 'desc',
    });
  });

  it('sorts folders by name naturally and by date, newest first', () => {
    const list = [
      folder('Photos 10', '2026-01-03'),
      folder('photos 2', '2026-01-01'),
      folder('Archive', '2026-01-02'),
    ];
    expect(sortFolders(list, { key: 'name', direction: 'asc' }).map((f) => f.name)).toEqual([
      'Archive',
      'photos 2',
      'Photos 10',
    ]);
    expect(sortFolders(list, { key: 'date', direction: 'desc' }).map((f) => f.name)).toEqual([
      'Photos 10',
      'Archive',
      'photos 2',
    ]);
  });

  it('orders trashed folders by when they were trashed', () => {
    const list = [folder('a', '2026-01-01', '2026-02-01'), folder('b', '2026-01-05', '2026-01-20')];
    expect(
      sortFolders(list, { key: 'date', direction: 'desc' }, 'trashedAt').map((f) => f.name),
    ).toEqual(['a', 'b']);
  });
});
