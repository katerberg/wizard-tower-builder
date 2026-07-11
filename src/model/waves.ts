import {
  SPAWN_INTERVAL_BRUTE,
  SPAWN_INTERVAL_ELITE,
  SPAWN_INTERVAL_SKIRMISHER,
  SPAWN_INTERVAL_SWARM,
} from '@/config/constants';
import type { ProgressionProvider, WaveDef } from './progression';

export const FINAL_LEVEL_INDEX = 9; // levels 0..9 => 10 levels

function waveBudget(levelIndex: number): { swarm: number; skirmisher: number; elite: number; brute: number } {
  const total = 40 + levelIndex * 25;
  const elite = Math.max(1, Math.floor(levelIndex / 2) + 1);
  const brute = levelIndex >= 7 ? Math.floor((levelIndex - 6) / 2) : 0;
  const skirmisher = levelIndex >= 4 ? 8 + levelIndex * 4 : 0;
  const swarm = Math.max(0, total - elite - skirmisher - brute);
  return { swarm, skirmisher, elite, brute };
}

// Swarm-heavy escalating waves with spaced elites and late brutes.
export const linearProgression: ProgressionProvider = {
  mode: 'linear',

  getWave(levelIndex: number): WaveDef {
    const { swarm, skirmisher, elite, brute } = waveBudget(levelIndex);
    const entries = [
      { templateId: 'swarm', count: swarm },
      { templateId: 'skirmisher', count: skirmisher },
      { templateId: 'elite', count: elite },
      { templateId: 'brute', count: brute },
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
