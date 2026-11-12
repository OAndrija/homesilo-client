import { fitItems, fitPhotos } from './fit';

describe('fitItems', () => {
  const item = { minWidth: 220, height: 66, gap: 12, minRows: 2 };

  it('fits columns by width and rows by height', () => {
    expect(fitItems({ width: 500, height: 300 }, item)).toEqual({ columns: 2, rows: 4 });
    expect(fitItems({ width: 500, height: 290 }, item)).toEqual({ columns: 2, rows: 3 });
    expect(fitItems({ width: 1100, height: 144 }, item)).toEqual({ columns: 4, rows: 2 });
  });

  it('never goes below the rows the area was sized for, or one column', () => {
    expect(fitItems({ width: 100, height: 10 }, item)).toEqual({ columns: 1, rows: 2 });
  });
});

describe('fitPhotos', () => {
  const options = { rows: 2, gap: 8, minCell: 72, maxCell: 200 };

  it('makes cells as tall as the rows allow and fills the width', () => {
    const fit = fitPhotos({ width: 1100, height: 260 }, options);
    expect(fit.rows).toBe(2);
    expect(fit.cell).toBe(126);
    expect(fit.columns).toBe(8);
  });

  it('adds rows instead of letting cells grow too big', () => {
    const fit = fitPhotos({ width: 600, height: 700 }, options);
    expect(fit.rows).toBe(4);
    expect(fit.cell).toBeLessThanOrEqual(200);
  });

  it('keeps cells usable in a short area', () => {
    expect(fitPhotos({ width: 300, height: 40 }, { ...options, rows: 1 }).cell).toBe(72);
  });
});
