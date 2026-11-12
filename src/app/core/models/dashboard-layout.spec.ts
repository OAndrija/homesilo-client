import { DEFAULT_LAYOUT, normalizeLayout, sameLayout, TILES } from './dashboard-layout';

describe('dashboard layout', () => {
  it('keeps known tiles in order and drops unknown ones and repeats', () => {
    expect(
      normalizeLayout([
        { id: 'recent', size: 'wide' },
        { id: 'from-a-newer-version', size: 'small' },
        { id: 'storage', size: 'small' },
        { id: 'recent', size: 'medium' },
      ]),
    ).toEqual([
      { id: 'recent', size: 'wide' },
      { id: 'storage', size: 'small' },
    ]);
  });

  it("falls back to a tile's default size when the saved one doesn't fit it", () => {
    expect(normalizeLayout([{ id: 'total-files', size: 'wide' }])).toEqual([
      { id: 'total-files', size: 'small' },
    ]);
  });

  it('compares layouts by order and size', () => {
    expect(sameLayout(DEFAULT_LAYOUT, [...DEFAULT_LAYOUT])).toBe(true);
    expect(sameLayout(DEFAULT_LAYOUT, [...DEFAULT_LAYOUT].reverse())).toBe(false);
    expect(sameLayout(DEFAULT_LAYOUT, DEFAULT_LAYOUT.slice(1))).toBe(false);
  });

  it('has a valid catalogue and default', () => {
    expect(new Set(TILES.map((t) => t.id)).size).toBe(TILES.length);
    for (const tile of TILES) expect(tile.sizes).toContain(tile.defaultSize);
    expect(normalizeLayout(DEFAULT_LAYOUT)).toEqual([...DEFAULT_LAYOUT]);
  });
});

describe('tile looks', () => {
  it('keeps a known look and drops the default or unknown ones', () => {
    expect(
      normalizeLayout([
        { id: 'storage', size: 'large', variant: 'ring' },
        { id: 'recent', size: 'wide', variant: 'ring' },
      ]),
    ).toEqual([
      { id: 'storage', size: 'large', variant: 'ring' },
      { id: 'recent', size: 'wide' },
    ]);
    expect(normalizeLayout([{ id: 'storage', size: 'large', variant: 'silo' }])).toEqual([
      { id: 'storage', size: 'large' },
    ]);
    expect(normalizeLayout([{ id: 'storage', size: 'large', variant: null }])).toEqual([
      { id: 'storage', size: 'large' },
    ]);
  });

  it('counts a different look as a different layout', () => {
    expect(
      sameLayout(
        [{ id: 'storage', size: 'large' }],
        [{ id: 'storage', size: 'large', variant: 'bars' }],
      ),
    ).toBe(false);
  });
});
