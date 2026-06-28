import type { ModificationDef } from './types';

const COSTS = [5, 8, 12];

/** Damages enemies each time they climb onto or past this room. */
export const spikes: ModificationDef = {
  id: 'spikes',
  name: 'Spikes',
  glyph: '^',
  color: '#a0aec0',
  description: 'Damages enemies each time they climb on or beside this room.',
  maxLevel: COSTS.length,
  cost: (level) => COSTS[level - 1] ?? Infinity,
  onEnemyStep: {
    run: (ctx) => {
      if (!ctx.enemyTouchesFootprint) return;
      ctx.attackEnemy(ctx.enemy, 2 * ctx.level);
    },
  },
};
