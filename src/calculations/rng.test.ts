import { describe, expect, it } from 'vitest';
import { seedFrom, shuffle } from './rng';

describe('shuffle', () => {
  it('returns a permutation of the input', () => {
    const source = ['a', 'b', 'c', 'd', 'e'];
    const { items } = shuffle(seedFrom('perm'), source);
    expect(items.sort()).toEqual(source.sort());
  });

  it('produces different orderings for different seeds', () => {
    const source = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const first = shuffle(seedFrom('seed-a'), source).items;
    const second = shuffle(seedFrom('seed-b'), source).items;
    expect(first).not.toEqual(second);
  });
});
