import { shareGrains } from './share-grains';

describe('shareGrains', () => {
  it('splits in proportion and always adds up', () => {
    expect(shareGrains([50, 30, 20], 10)).toEqual([5, 3, 2]);
    const counts = shareGrains([45, 30, 12, 7, 3, 3], 38);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(38);
    expect(counts[0]).toBeGreaterThan(counts[1]);
  });

  it('gives a tiny share one grain', () => {
    expect(shareGrains([999, 1], 10)).toEqual([9, 1]);
  });

  it('gives the biggest ones a grain each when there are too few', () => {
    expect(shareGrains([1, 5, 3], 2)).toEqual([0, 1, 1]);
  });

  it('gives nothing when there is nothing to give', () => {
    expect(shareGrains([10, 20], 0)).toEqual([0, 0]);
    expect(shareGrains([0, 0], 5)).toEqual([0, 0]);
  });
});
