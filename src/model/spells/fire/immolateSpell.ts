import { startImmolate } from './immolate';
import type { SpellDef } from '../types';

export const immolate: SpellDef = {
  id: 'immolate',
  name: 'Immolate',
  glyph: '^',
  description: 'Burns a climber while they stay on the wall. Ticks ramp, then cap.',
  manaCost: 3,
  cooldown: 1.5,
  targeting: 'enemy',
  range: 10,
  damage: 0,
  cast(ctx, target) {
    if (target.kind !== 'enemy') return;
    const enemy = ctx.state.enemies.find((e) => e.id === target.enemyId);
    if (!enemy || enemy.currentHp <= 0) return;
    startImmolate(ctx.state, enemy);
    ctx.log(`Immolate seizes ${enemy.name} on the wall.`, 'combat');
  },
};
