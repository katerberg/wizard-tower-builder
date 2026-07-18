import {
  SPAWN_INTERVAL_BRUTE,
  SPAWN_INTERVAL_CARRIER,
  SPAWN_INTERVAL_ELITE,
  SPAWN_INTERVAL_KAMIKAZE,
  SPAWN_INTERVAL_SKIRMISHER,
  SPAWN_INTERVAL_STRIKER,
  SPAWN_INTERVAL_SWARM,
} from '@/config/constants';
import type { ProgressionProvider, WaveDef } from './progression';

export const FINAL_LEVEL_INDEX = 9; // levels 0..9 => 10 levels

function crawlerBudget(levelIndex: number): {
  swarm: number;
  skirmisher: number;
  elite: number;
  brute: number;
} {
  const total = 40 + levelIndex * 25;
  const elite = Math.max(1, Math.floor(levelIndex / 2) + 1);
  const brute = levelIndex >= 7 ? Math.floor((levelIndex - 6) / 2) : 0;
  const skirmisher = levelIndex >= 4 ? 8 + levelIndex * 4 : 0;
  const swarm = Math.max(0, total - elite - skirmisher - brute);
  return { swarm, skirmisher, elite, brute };
}

/** Separate from crawler fodder so fliers do not starve the climb pressure. */
function flierBudget(levelIndex: number): {
  striker: number;
  kamikaze: number;
  carrier: number;
} {
  // Early tease, then ramp. Placeholders — tune in playtest.
  if (levelIndex <= 0) return { striker: 0, kamikaze: 0, carrier: 0 };
  if (levelIndex === 1) return { striker: 2, kamikaze: 0, carrier: 0 };
  if (levelIndex === 2) return { striker: 3, kamikaze: 0, carrier: 0 };
  if (levelIndex === 3) return { striker: 4, kamikaze: 1, carrier: 0 };
  if (levelIndex === 4) return { striker: 5, kamikaze: 2, carrier: 0 };
  if (levelIndex === 5) return { striker: 6, kamikaze: 3, carrier: 0 };
  if (levelIndex === 6) return { striker: 7, kamikaze: 3, carrier: 1 };
  if (levelIndex === 7) return { striker: 8, kamikaze: 4, carrier: 1 };
  if (levelIndex === 8) return { striker: 10, kamikaze: 5, carrier: 2 };
  return { striker: 12, kamikaze: 6, carrier: 2 };
}

// Swarm-heavy escalating waves with spaced elites, late brutes, and a flier lane.
export const linearProgression: ProgressionProvider = {
  mode: 'linear',

  getWave(levelIndex: number): WaveDef {
    const { swarm, skirmisher, elite, brute } = crawlerBudget(levelIndex);
    const { striker, kamikaze, carrier } = flierBudget(levelIndex);
    const entries = [
      { templateId: 'swarm', count: swarm },
      { templateId: 'skirmisher', count: skirmisher },
      { templateId: 'elite', count: elite },
      { templateId: 'brute', count: brute },
      { templateId: 'striker', count: striker },
      { templateId: 'kamikaze', count: kamikaze },
      { templateId: 'carrier', count: carrier },
    ].filter((e) => e.count > 0);
    return { entries };
  },

  rewardFor(levelIndex: number): number {
    return 8 + levelIndex * 4;
  },

  isFinalLevel(levelIndex: number): boolean {
    return levelIndex >= FINAL_LEVEL_INDEX;
  },
};

/** Per-type spawn interval (seconds between dequeue). */
export function spawnIntervalFor(templateId: string): number {
  switch (templateId) {
    case 'skirmisher':
      return SPAWN_INTERVAL_SKIRMISHER;
    case 'elite':
      return SPAWN_INTERVAL_ELITE;
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
