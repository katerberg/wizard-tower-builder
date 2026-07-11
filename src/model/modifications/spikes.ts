import type { ModificationDef } from './types';

const COSTS = [5, 8, 12];
export const SPIKES_DAMAGE_PER_LEVEL = 2;

/** Damages enemies each time they climb onto or past this room. */
export const spikes: ModificationDef = {
  id: 'spikes',
  name: 'Spikes',
  glyph: '^',
  color: '#a0aec0',
  description: 'Punishes climbers who step on or beside this room.',
  mechanicsAtLevel: (level) => `${SPIKES_DAMAGE_PER_LEVEL * level} damage per enemy step on/adjacent`,
  maxLevel: COSTS.length,
  cost: (level) => COSTS[level - 1] ?? Infinity,
  onEnemyStep: {
    run: (ctx) => {
      if (!ctx.enemyTouchesFootprint) return;
      ctx.attackEnemy(ctx.enemy, SPIKES_DAMAGE_PER_LEVEL * ctx.level);
    },
  },
};
