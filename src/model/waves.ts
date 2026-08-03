import {
  SPAWN_INTERVAL_BRUTE,
  SPAWN_INTERVAL_CARRIER,
  SPAWN_INTERVAL_DEMOLISHER,
  SPAWN_INTERVAL_ELITE,
  SPAWN_INTERVAL_KAMIKAZE,
  SPAWN_INTERVAL_SKIRMISHER,
  SPAWN_INTERVAL_STRIKER,
  SPAWN_INTERVAL_SWARM,
} from '@/config/constants';
import type { ProgressionProvider, WaveContext, WaveDef } from './progression';

/** Clear a wave while framing height is at least this to win. */
export const WIN_HEIGHT = 100;

/** Chess-like point costs for budget fill. */
export const ENEMY_POINT_COST: Record<string, number> = {
  swarm: 1,
  skirmisher: 2,
  striker: 3,
  kamikaze: 4,
  elite: 8,
  demolisher: 8,
  demolisherElite: 8,
  demolisherBrute: 8,
  carrier: 15,
  brute: 20,
};

/** Permanent unlock thresholds (height = max occupied framing row). */
export const UNLOCK_THRESHOLDS: readonly { height: number; ids: readonly string[] }[] = [
  { height: 0, ids: ['swarm', 'elite'] },
  { height: 15, ids: ['striker'] },
  { height: 30, ids: ['kamikaze', 'demolisher'] },
  { height: 40, ids: ['skirmisher'] },
  { height: 55, ids: ['demolisherElite'] },
  { height: 70, ids: ['carrier'] },
  { height: 80, ids: ['demolisherBrute'] },
  { height: 85, ids: ['brute'] },
];

/** Home height for slot/target scaling (matches unlock ladder). */
const HOME_HEIGHT: Record<string, number> = {
  swarm: 0,
  elite: 0,
  striker: 15,
  kamikaze: 30,
  demolisher: 30,
  skirmisher: 40,
  demolisherElite: 55,
  carrier: 70,
  demolisherBrute: 80,
  brute: 85,
};

/** When unlocked but below home height — “a few,” not a full home-band army. */
const BELOW_HOME_MAX: Record<string, number> = {
  swarm: Number.POSITIVE_INFINITY,
  elite: 1,
  brute: 1,
  carrier: 1,
  striker: 2,
  kamikaze: 1,
  skirmisher: 8,
  demolisher: 1,
  demolisherElite: 1,
  demolisherBrute: 1,
};

interface Plateau {
  minHeight: number;
  budget: number;
  eliteSlots: number;
  bruteSlots: number;
  carrierSlots: number;
  /** Cap across all demolisher size tiers combined. */
  demolisherSlots: number;
  strikerTarget: number;
  kamikazeTarget: number;
  /** Fraction of remaining fodder budget spent on skirmishers when unlocked at/above home. */
  skirmisherShare: number;
}

/** Flat plateaus — no per-row seal breaks (anti-grind). */
const PLATEAUS: readonly Plateau[] = [
  {
    minHeight: 0,
    budget: 48,
    eliteSlots: 1,
    bruteSlots: 0,
    carrierSlots: 0,
    demolisherSlots: 0,
    strikerTarget: 0,
    kamikazeTarget: 0,
    skirmisherShare: 0,
  },
  {
    minHeight: 15,
    budget: 72,
    eliteSlots: 1,
    bruteSlots: 0,
    carrierSlots: 0,
    demolisherSlots: 0,
    strikerTarget: 3,
    kamikazeTarget: 0,
    skirmisherShare: 0,
  },
  {
    minHeight: 30,
    budget: 100,
    eliteSlots: 2,
    bruteSlots: 0,
    carrierSlots: 0,
    demolisherSlots: 1,
    strikerTarget: 5,
    kamikazeTarget: 2,
    skirmisherShare: 0,
  },
  {
    minHeight: 40,
    budget: 140,
    eliteSlots: 2,
    bruteSlots: 0,
    carrierSlots: 0,
    demolisherSlots: 1,
    strikerTarget: 6,
    kamikazeTarget: 3,
    skirmisherShare: 0.28,
  },
  {
    minHeight: 55,
    budget: 185,
    eliteSlots: 4,
    bruteSlots: 0,
    carrierSlots: 0,
    demolisherSlots: 1,
    strikerTarget: 8,
    kamikazeTarget: 4,
    skirmisherShare: 0.3,
  },
  {
    minHeight: 70,
    budget: 230,
    eliteSlots: 5,
    bruteSlots: 0,
    carrierSlots: 1,
    demolisherSlots: 2,
    strikerTarget: 10,
    kamikazeTarget: 5,
    skirmisherShare: 0.3,
  },
  {
    minHeight: 85,
    budget: 275,
    eliteSlots: 5,
    bruteSlots: 1,
    carrierSlots: 2,
    demolisherSlots: 2,
    strikerTarget: 12,
    kamikazeTarget: 6,
    skirmisherShare: 0.32,
  },
  {
    minHeight: 100,
    budget: 320,
    eliteSlots: 6,
    bruteSlots: 2,
    carrierSlots: 2,
    demolisherSlots: 2,
    strikerTarget: 14,
    kamikazeTarget: 7,
    skirmisherShare: 0.32,
  },
];

export function plateauForHeight(height: number): Plateau {
  const h = Math.max(0, Math.floor(height));
  let chosen = PLATEAUS[0];
  for (const p of PLATEAUS) {
    if (h >= p.minHeight) chosen = p;
  }
  return chosen;
}

/** Merge newly crossed unlock thresholds into the run’s permanent set. */
export function unlockEnemiesForHeight(
  unlocked: ReadonlySet<string> | readonly string[],
  height: number,
): string[] {
  const next = new Set(unlocked);
  const h = Math.max(0, Math.floor(height));
  for (const tier of UNLOCK_THRESHOLDS) {
    if (h >= tier.height) {
      for (const id of tier.ids) next.add(id);
    }
  }
  return [...next].sort();
}

function isUnlocked(unlocked: ReadonlySet<string>, id: string): boolean {
  return unlocked.has(id);
}

function maxForType(templateId: string, height: number, atHomeCap: number): number {
  const home = HOME_HEIGHT[templateId] ?? 0;
  if (height >= home) return atHomeCap;
  return BELOW_HOME_MAX[templateId] ?? 1;
}

function takeCount(
  counts: Record<string, number>,
  templateId: string,
  want: number,
  budget: { remaining: number },
): void {
  if (want <= 0) return;
  const cost = ENEMY_POINT_COST[templateId] ?? 1;
  const affordable = Math.floor(budget.remaining / cost);
  const n = Math.min(want, affordable);
  if (n <= 0) return;
  counts[templateId] = (counts[templateId] ?? 0) + n;
  budget.remaining -= n * cost;
}

const DEMOLISHER_TIERS = ['demolisherBrute', 'demolisherElite', 'demolisher'] as const;

function composeWave(ctx: WaveContext): WaveDef {
  const height = Math.max(0, Math.floor(ctx.height));
  const plateau = plateauForHeight(height);
  const unlocked = ctx.unlockedEnemyIds;
  const budget = { remaining: plateau.budget };
  const counts: Record<string, number> = {};

  // Heavies first (slots), then specialty fliers, then skirmisher share, then swarm.
  if (isUnlocked(unlocked, 'brute')) {
    takeCount(counts, 'brute', maxForType('brute', height, plateau.bruteSlots), budget);
  }
  if (isUnlocked(unlocked, 'carrier')) {
    takeCount(counts, 'carrier', maxForType('carrier', height, plateau.carrierSlots), budget);
  }
  // Prefer heavier demolisher tiers; share a single slot budget across the ladder.
  let demolisherRemaining = plateau.demolisherSlots;
  for (const id of DEMOLISHER_TIERS) {
    if (!isUnlocked(unlocked, id) || demolisherRemaining <= 0) continue;
    const want = maxForType(id, height, demolisherRemaining);
    const before = counts[id] ?? 0;
    takeCount(counts, id, want, budget);
    demolisherRemaining -= (counts[id] ?? 0) - before;
  }
  if (isUnlocked(unlocked, 'elite')) {
    takeCount(counts, 'elite', maxForType('elite', height, plateau.eliteSlots), budget);
  }
  if (isUnlocked(unlocked, 'kamikaze')) {
    takeCount(counts, 'kamikaze', maxForType('kamikaze', height, plateau.kamikazeTarget), budget);
  }
  if (isUnlocked(unlocked, 'striker')) {
    takeCount(counts, 'striker', maxForType('striker', height, plateau.strikerTarget), budget);
  }
  if (isUnlocked(unlocked, 'skirmisher')) {
    const skirmisherHome = HOME_HEIGHT.skirmisher ?? 40;
    const shareCap =
      height >= skirmisherHome
        ? Math.floor((budget.remaining * plateau.skirmisherShare) / (ENEMY_POINT_COST.skirmisher ?? 2))
        : (BELOW_HOME_MAX.skirmisher ?? 8);
    takeCount(counts, 'skirmisher', shareCap, budget);
  }
  if (isUnlocked(unlocked, 'swarm')) {
    takeCount(counts, 'swarm', Number.POSITIVE_INFINITY, budget);
  }

  const entries = [
    { templateId: 'swarm', count: counts.swarm ?? 0 },
    { templateId: 'skirmisher', count: counts.skirmisher ?? 0 },
    { templateId: 'elite', count: counts.elite ?? 0 },
    { templateId: 'demolisher', count: counts.demolisher ?? 0 },
    { templateId: 'demolisherElite', count: counts.demolisherElite ?? 0 },
    { templateId: 'demolisherBrute', count: counts.demolisherBrute ?? 0 },
    { templateId: 'brute', count: counts.brute ?? 0 },
    { templateId: 'striker', count: counts.striker ?? 0 },
    { templateId: 'kamikaze', count: counts.kamikaze ?? 0 },
    { templateId: 'carrier', count: counts.carrier ?? 0 },
  ].filter((e) => e.count > 0);

  return { entries };
}

/** Height-based progression: budget/slots from current height; unlocks from run set. */
export const heightProgression: ProgressionProvider = {
  mode: 'height',

  getWave(ctx: WaveContext): WaveDef {
    return composeWave(ctx);
  },

  rewardFor(height: number): number {
    const plateau = plateauForHeight(height);
    return 8 + Math.floor(plateau.budget / 12);
  },

  isVictoryHeight(height: number): boolean {
    return Math.floor(height) >= WIN_HEIGHT;
  },
};

/** @deprecated Use heightProgression — kept as alias for older imports during transition. */
export const linearProgression = heightProgression;

/** Per-type spawn interval (seconds between dequeue). */
export function spawnIntervalFor(templateId: string): number {
  switch (templateId) {
    case 'skirmisher':
      return SPAWN_INTERVAL_SKIRMISHER;
    case 'elite':
      return SPAWN_INTERVAL_ELITE;
    case 'demolisher':
    case 'demolisherElite':
    case 'demolisherBrute':
      return SPAWN_INTERVAL_DEMOLISHER;
    case 'brute':
      return SPAWN_INTERVAL_BRUTE;
    case 'striker':
      return SPAWN_INTERVAL_STRIKER;
    case 'kamikaze':
    case 'carrierKamikaze':
      return SPAWN_INTERVAL_KAMIKAZE;
    case 'carrier':
      return SPAWN_INTERVAL_CARRIER;
    default:
      return SPAWN_INTERVAL_SWARM;
  }
}

// Flatten a wave into an ordered spawn queue of template ids.
export function buildSpawnQueue(def: WaveDef): string[] {
  const queue: string[] = [];
  const maxCount = Math.max(0, ...def.entries.map((e) => e.count));
  // Interleave types so a wave feels mixed rather than blocky.
  for (let i = 0; i < maxCount; i++) {
    for (const entry of def.entries) {
      if (i < entry.count) {
        queue.push(entry.templateId);
      }
    }
  }
  return queue;
}

/** Enemy ids the wave composer (and wave builder) can place — excludes carrier drones. */
export const WAVE_BUILDER_ENEMY_IDS = [
  'swarm',
  'skirmisher',
  'elite',
  'demolisher',
  'demolisherElite',
  'demolisherBrute',
  'brute',
  'striker',
  'kamikaze',
  'carrier',
] as const;

/** Chess-point total for a wave definition. */
export function wavePointScore(def: WaveDef): number {
  let score = 0;
  for (const entry of def.entries) {
    if (entry.count <= 0) continue;
    score += entry.count * (ENEMY_POINT_COST[entry.templateId] ?? 1);
  }
  return score;
}

/** Nearest plateau by budget; ties prefer the lower minHeight. */
export function estimatePlateauForScore(score: number): { minHeight: number; budget: number } {
  const s = Math.max(0, score);
  let best = PLATEAUS[0];
  let bestDist = Math.abs(best.budget - s);
  for (const p of PLATEAUS) {
    const dist = Math.abs(p.budget - s);
    if (dist < bestDist || (dist === bestDist && p.minHeight < best.minHeight)) {
      best = p;
      bestDist = dist;
    }
  }
  return { minHeight: best.minHeight, budget: best.budget };
}

/** Build a WaveDef from a count map (drops zero/negative counts). */
export function waveDefFromCounts(counts: Readonly<Record<string, number>>): WaveDef {
  const entries = WAVE_BUILDER_ENEMY_IDS.map((templateId) => ({
    templateId,
    count: Math.max(0, Math.floor(counts[templateId] ?? 0)),
  })).filter((e) => e.count > 0);
  return { entries };
}
