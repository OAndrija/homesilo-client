export interface Area {
  width: number;
  height: number;
}

/**
 * How many fixed-height items fit in an area: as many columns of at least
 * `minWidth` as the width allows, and as many rows as the height allows (never
 * fewer than `minRows`, which is what the area was sized for).
 */
export function fitItems(
  area: Area,
  item: { minWidth: number; height: number; gap: number; minRows: number },
): { columns: number; rows: number } {
  const columns = Math.max(1, Math.floor((area.width + item.gap) / (item.minWidth + item.gap)));
  const rows = Math.max(
    item.minRows,
    Math.floor((area.height + item.gap) / (item.height + item.gap)),
  );
  return { columns, rows };
}

/**
 * Square-ish photo cells that fill an area: `rows` rows (more if the cells would
 * grow past `maxCell`), cells as tall as the height allows, and as many columns
 * as fit at that size. Columns then stretch to use the width exactly.
 */
export function fitPhotos(
  area: Area,
  options: { rows: number; gap: number; minCell: number; maxCell: number },
): { columns: number; rows: number; cell: number } {
  const { gap, minCell, maxCell } = options;
  let rows = Math.max(1, options.rows);
  const cellFor = (r: number) => (area.height - gap * (r - 1)) / r;
  while (cellFor(rows) > maxCell) rows++;
  const cell = Math.max(minCell, cellFor(rows));
  const columns = Math.max(1, Math.round((area.width + gap) / (cell + gap)));
  return { columns, rows, cell };
}
