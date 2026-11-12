import { nearestSize, spans } from './tile-gestures';

describe('tile resizing', () => {
  const all = ['small', 'medium', 'large', 'wide'] as const;

  it('knows how much of the grid each size covers', () => {
    expect(spans('small', 4)).toEqual([1, 1]);
    expect(spans('medium', 4)).toEqual([2, 1]);
    expect(spans('large', 4)).toEqual([2, 2]);
    expect(spans('wide', 4)).toEqual([4, 1]);
    // On a phone's two columns, medium and wide are the same width.
    expect(spans('wide', 2)).toEqual([2, 1]);
  });

  it('snaps to the closest size the pointer asks for', () => {
    expect(nearestSize(all, 'small', 2.1, 1, 4)).toBe('medium');
    expect(nearestSize(all, 'small', 2, 2.2, 4)).toBe('large');
    expect(nearestSize(all, 'medium', 3.9, 1, 4)).toBe('wide');
    expect(nearestSize(all, 'large', 0.8, 0.9, 4)).toBe('small');
  });

  it('only offers sizes the tile allows', () => {
    expect(nearestSize(['small', 'medium'], 'small', 4, 2, 4)).toBe('medium');
  });

  it('keeps the current size on a boundary', () => {
    // Halfway between one and two columns: no flicker.
    expect(nearestSize(all, 'small', 1.55, 1, 4)).toBe('small');
    expect(nearestSize(all, 'medium', 1.45, 1, 4)).toBe('medium');
  });
});
