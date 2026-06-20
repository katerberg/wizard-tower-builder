// Deterministic seeded RNG (mulberry32). State is a single uint32 so it can be
// serialized directly into GameState.rngState for reproducible runs.

export function nextRandom(state: number): { value: number; state: number } {
  let t = (state + 0x6d2b79f5) | 0;
  const nextState = t >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, state: nextState };
}

export function randomInt(state: number, minInclusive: number, maxInclusive: number): { value: number; state: number } {
  const { value, state: nextState } = nextRandom(state);
  const span = maxInclusive - minInclusive + 1;
  return { value: minInclusive + Math.floor(value * span), state: nextState };
}

export function randomItem<T>(state: number, items: readonly T[]): { value: T; state: number } {
  const { value, state: nextState } = randomInt(state, 0, items.length - 1);
  return { value: items[value], state: nextState };
}

export function seedFrom(input: string | number): number {
  if (typeof input === 'number') {
    return input >>> 0;
  }
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
