import type { ProgressionProvider, WaveDef } from './progression';

export const FINAL_LEVEL_INDEX = 9; // levels 0..9 => 10 levels

// Linear escalating waves: more goblins each level, brutes from level 2, a few
// fast wisps in the back half. Reward scales with level.
export const linearProgression: ProgressionProvider = {
  mode: 'linear',

  getWave(levelIndex: number): WaveDef {
    const goblins = 3 + levelIndex * 2;
    const brutes = Math.max(0, Math.floor((levelIndex - 1) / 2));
    const wisps = levelIndex >= 5 ? levelIndex - 4 : 0;
    const entries = [
      { templateId: 'goblin', count: goblins },
      { templateId: 'brute', count: brutes },
      { templateId: 'wisp', count: wisps },
    ].filter((e) => e.count > 0);
    return { entries };
  },

  rewardFor(levelIndex: number): number {
    return 6 + levelIndex * 3;
  },

  isFinalLevel(levelIndex: number): boolean {
    return levelIndex >= FINAL_LEVEL_INDEX;
  },
};

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
