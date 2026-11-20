/**
 * Splits `total` grains between items in proportion to their weights. Every item
 * with weight gets at least one grain while there are enough to go round; the
 * rest go by the largest remainder, so the counts always add up to `total`.
 */
export function shareGrains(weights: readonly number[], total: number): number[] {
  const sum = weights.reduce((a, b) => a + Math.max(b, 0), 0);
  const counts = weights.map(() => 0);
  if (total <= 0 || sum <= 0) return counts;
  // Too few grains for everyone: the biggest items get one each.
  const ranked = weights
    .map((w, i) => ({ w, i }))
    .filter((x) => x.w > 0)
    .sort((a, b) => b.w - a.w);
  if (ranked.length >= total) {
    ranked.slice(0, total).forEach((x) => (counts[x.i] = 1));
    return counts;
  }
  const ideal = weights.map((w) => (Math.max(w, 0) / sum) * total);
  ranked.forEach((x) => (counts[x.i] = Math.max(1, Math.floor(ideal[x.i]))));
  let given = counts.reduce((a, b) => a + b, 0);
  // The minimum of one can overshoot: take back from the largest counts.
  while (given > total) {
    const most = counts.indexOf(Math.max(...counts));
    counts[most]--;
    given--;
  }
  // Hand out what's left by the largest remainder.
  const byRemainder = ranked
    .map((x) => ({ i: x.i, r: ideal[x.i] - counts[x.i] }))
    .sort((a, b) => b.r - a.r);
  for (let k = 0; given < total; k = (k + 1) % byRemainder.length) {
    counts[byRemainder[k].i]++;
    given++;
  }
  return counts;
}
