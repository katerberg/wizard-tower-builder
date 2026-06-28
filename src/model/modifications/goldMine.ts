import type { ModificationDef } from './types';

const COSTS = [8, 14, 20];

/** Passive income: pays out gold each time a wave is cleared. */
export const goldMine: ModificationDef = {
  id: 'goldMine',
  name: 'Gold Mine',
  glyph: '$',
  color: '#ecc94b',
  description: 'Generates gold each time a wave is cleared.',
  maxLevel: COSTS.length,
  cost: (level) => COSTS[level - 1] ?? Infinity,
  onWaveCleared: (ctx) => {
    const income = 4 * ctx.level;
    ctx.reward(income);
    ctx.log(`Gold Mine yields ${income} gold.`, 'economy');
  },
};
