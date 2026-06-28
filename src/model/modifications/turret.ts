import type { ModificationDef } from './types';

const COSTS = [10, 16, 24];

/** Auto-attacks the nearest enemy within range, like a stationary wizard. */
export const turret: ModificationDef = {
  id: 'turret',
  name: 'Turret',
  glyph: '*',
  color: '#f6ad55',
  description: 'Fires at the nearest enemy within range during a wave.',
  maxLevel: COSTS.length,
  cost: (level) => COSTS[level - 1] ?? Infinity,
  attack: {
    cooldown: () => 0.9,
    run: (ctx) => {
      const range = 2 + ctx.level;
      const attack = 3 + 2 * ctx.level;
      const target = ctx.enemiesNear(range)[0];
      if (target) {
        ctx.attackEnemy(target, attack);
      }
    },
  },
};
