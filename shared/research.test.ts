import { describe, expect, it } from 'vitest';
import { matchesCategory } from './research';

describe('matchesCategory', () => {
  it('always matches the aggregate topic', () => {
    expect(matchesCategory('経済・通貨', '総合')).toBe(true);
  });

  it('matches exact and segment-level categories', () => {
    expect(matchesCategory('経済', '経済')).toBe(true);
    expect(matchesCategory('経済・通貨', '経済')).toBe(true);
    expect(matchesCategory('政治・安全保障', '政治・規制')).toBe(true);
    expect(matchesCategory('社会・気候', '災害・気候')).toBe(true);
  });

  it('rejects unrelated categories', () => {
    expect(matchesCategory('社会・生活', '経済')).toBe(false);
    expect(matchesCategory('技術・産業', '災害・気候')).toBe(false);
  });
});
