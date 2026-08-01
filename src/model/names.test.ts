import { describe, expect, it } from 'vitest';
import { bruteNames, goblinNames, wispNames } from './names';

describe('name pools', () => {
  it('expands each pool to 100x its original seed count with unique entries', () => {
    expect(goblinNames).toHaveLength(800);
    expect(bruteNames).toHaveLength(600);
    expect(wispNames).toHaveLength(500);
    expect(new Set(goblinNames).size).toBe(800);
    expect(new Set(bruteNames).size).toBe(600);
    expect(new Set(wispNames).size).toBe(500);
  });

  it('keeps the original flavor names in each pool', () => {
    expect(goblinNames).toContain('Snik');
    expect(bruteNames).toContain('Crag');
    expect(wispNames).toContain('Flicker');
  });
});
