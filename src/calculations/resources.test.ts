import { describe, expect, it } from 'vitest';
import { formatResourceAmount, formatResourceCost } from './resources';

describe('formatResourceAmount', () => {
  it('keeps whole numbers without a decimal', () => {
    expect(formatResourceAmount(40)).toBe('40');
    expect(formatResourceAmount(40.016666666666666)).toBe('40');
  });

  it('rounds fractional amounts to one decimal place', () => {
    expect(formatResourceAmount(36.05)).toBe('36.1');
    expect(formatResourceAmount(36.04)).toBe('36');
  });
});

describe('formatResourceCost', () => {
  it('formats fractional resource amounts', () => {
    expect(formatResourceCost({ metal: 40.016666666666666, stone: 36.05 })).toBe(
      '40 metal + 36.1 stone',
    );
  });
});
