import { squarify, TreemapRect } from './treemap';

const area = (r: TreemapRect) => r.w * r.h;

describe('squarify', () => {
  it('gives each value its share of the square', () => {
    const values = [17, 11, 4.6, 2.7, 1.1, 1.1, 62];
    const rects = squarify(values);
    const total = values.reduce((a, b) => a + b, 0);
    values.forEach((v, i) => expect(area(rects[i])).toBeCloseTo(v / total, 6));
  });

  it('stays inside the square without overlaps', () => {
    const rects = squarify([6, 6, 4, 3, 2, 2, 1]);
    for (const r of rects) {
      expect(r.x).toBeGreaterThanOrEqual(-1e-9);
      expect(r.y).toBeGreaterThanOrEqual(-1e-9);
      expect(r.x + r.w).toBeLessThanOrEqual(1 + 1e-9);
      expect(r.y + r.h).toBeLessThanOrEqual(1 + 1e-9);
    }
    for (let a = 0; a < rects.length; a++) {
      for (let b = a + 1; b < rects.length; b++) {
        const [p, q] = [rects[a], rects[b]];
        const overlap =
          Math.max(0, Math.min(p.x + p.w, q.x + q.w) - Math.max(p.x, q.x)) *
          Math.max(0, Math.min(p.y + p.h, q.y + q.h) - Math.max(p.y, q.y));
        expect(overlap).toBeLessThan(1e-9);
      }
    }
  });

  it('keeps equal values square', () => {
    for (const r of squarify([1, 1, 1, 1])) {
      expect(r.w).toBeCloseTo(0.5, 6);
      expect(r.h).toBeCloseTo(0.5, 6);
    }
  });

  it('leaves empty values empty', () => {
    expect(squarify([0, 0])).toEqual([
      { x: 0, y: 0, w: 0, h: 0 },
      { x: 0, y: 0, w: 0, h: 0 },
    ]);
    expect(area(squarify([5, 0])[1])).toBe(0);
  });
});
