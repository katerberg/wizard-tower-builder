import type { ResourceCost, ResourceId, Resources } from '@/model/types';

export const RESOURCE_IDS: ResourceId[] = ['gold', 'metal', 'stone', 'souls'];

export const RESOURCE_LABELS: Record<ResourceId, string> = {
  gold: 'Gold',
  metal: 'Metal',
  stone: 'Stone',
  souls: 'Souls',
};

export function emptyResources(): Resources {
  return { gold: 0, metal: 0, stone: 0, souls: 0 };
}

export function cloneResources(r: Resources): Resources {
  return { gold: r.gold, metal: r.metal, stone: r.stone, souls: r.souls };
}

/** Normalize a partial cost into a full Resources bag. */
export function asResources(cost: ResourceCost | Resources): Resources {
  return {
    gold: cost.gold ?? 0,
    metal: cost.metal ?? 0,
    stone: cost.stone ?? 0,
    souls: cost.souls ?? 0,
  };
}

export function addResources(a: Resources, b: ResourceCost): Resources {
  const add = asResources(b);
  return {
    gold: a.gold + add.gold,
    metal: a.metal + add.metal,
    stone: a.stone + add.stone,
    souls: a.souls + add.souls,
  };
}

export function subResources(a: Resources, b: ResourceCost): Resources {
  const sub = asResources(b);
  return {
    gold: a.gold - sub.gold,
    metal: a.metal - sub.metal,
    stone: a.stone - sub.stone,
    souls: a.souls - sub.souls,
  };
}

export function scaleResources(cost: ResourceCost, factor: number): Resources {
  const r = asResources(cost);
  return {
    gold: r.gold * factor,
    metal: r.metal * factor,
    stone: r.stone * factor,
    souls: r.souls * factor,
  };
}

export function canAffordResources(wallet: Resources, cost: ResourceCost): boolean {
  const need = asResources(cost);
  return (
    wallet.gold >= need.gold &&
    wallet.metal >= need.metal &&
    wallet.stone >= need.stone &&
    wallet.souls >= need.souls
  );
}

export function isZeroCost(cost: ResourceCost): boolean {
  const r = asResources(cost);
  return r.gold === 0 && r.metal === 0 && r.stone === 0 && r.souls === 0;
}

export function resourcesEqual(a: Resources, b: Resources): boolean {
  return a.gold === b.gold && a.metal === b.metal && a.stone === b.stone && a.souls === b.souls;
}

const RESOURCE_AMOUNT_FORMAT = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 1,
  useGrouping: false,
});

/** Display amount with at most one decimal place (e.g. 40, 36.1). */
export function formatResourceAmount(n: number): string {
  return RESOURCE_AMOUNT_FORMAT.format(n);
}

/** Human-readable cost, e.g. "6 metal" or "4 metal + 2 souls". */
export function formatResourceCost(cost: ResourceCost): string {
  const parts: string[] = [];
  for (const id of RESOURCE_IDS) {
    const n = cost[id] ?? 0;
    if (n !== 0) parts.push(`${formatResourceAmount(n)} ${id}`);
  }
  return parts.length > 0 ? parts.join(' + ') : 'free';
}

export function totalResourceUnits(cost: ResourceCost): number {
  const r = asResources(cost);
  return r.gold + r.metal + r.stone + r.souls;
}
