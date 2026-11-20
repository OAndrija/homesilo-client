/** A rectangle in a unit square: x, y, width and height from 0 to 1. */
export interface TreemapRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Lays values out as rectangles that fill the unit square, each with an area in
 * proportion to its value, kept as close to square as possible (the "squarified"
 * treemap of Bruls, Huizing and van Wijk). Rectangles come back in the order of
 * the values; items are placed in that order, so put the ones that belong
 * together first.
 */
export function squarify(values: readonly number[]): TreemapRect[] {
  const total = values.reduce((a, b) => a + Math.max(b, 0), 0);
  const rects: TreemapRect[] = values.map(() => ({ x: 0, y: 0, w: 0, h: 0 }));
  if (total <= 0) return rects;

  const areas = values.map((v) => Math.max(v, 0) / total);
  let free = { x: 0, y: 0, w: 1, h: 1 };
  let row: number[] = [];

  /** The worst aspect ratio in a row laid along a side of length `side`. */
  const worst = (indices: number[], side: number): number => {
    const sum = indices.reduce((a, i) => a + areas[i], 0);
    if (sum <= 0) return Infinity;
    let max = 0;
    let min = Infinity;
    for (const i of indices) {
      max = Math.max(max, areas[i]);
      min = Math.min(min, areas[i]);
    }
    return Math.max((side * side * max) / (sum * sum), (sum * sum) / (side * side * min));
  };

  /** Places a row along the shorter side of what's left, and shrinks what's left. */
  const place = (indices: number[]): void => {
    const sum = indices.reduce((a, i) => a + areas[i], 0);
    const horizontal = free.w >= free.h; // a column on the left, or a row on top
    const thickness = horizontal ? sum / free.h : sum / free.w;
    let offset = 0;
    for (const i of indices) {
      const length = sum > 0 ? areas[i] / thickness : 0;
      rects[i] = horizontal
        ? { x: free.x, y: free.y + offset, w: thickness, h: length }
        : { x: free.x + offset, y: free.y, w: length, h: thickness };
      offset += length;
    }
    free = horizontal
      ? { x: free.x + thickness, y: free.y, w: free.w - thickness, h: free.h }
      : { x: free.x, y: free.y + thickness, w: free.w, h: free.h - thickness };
  };

  const order = areas.map((_, i) => i).filter((i) => areas[i] > 0);
  for (const i of order) {
    const side = Math.min(free.w, free.h);
    if (row.length === 0 || worst([...row, i], side) <= worst(row, side)) {
      row.push(i);
    } else {
      place(row);
      row = [i];
    }
  }
  if (row.length) place(row);
  return rects;
}
