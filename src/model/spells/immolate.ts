import type { SpellDef } from './types';
import { startImmolate } from './fire/immolate';

export const immolate: SpellDef = {
  id: 'immolate',
  name: 'Immolate',
  glyph: 'I',
  description: 'Burns one wall climber. Ramps while they crawl the shell; ends if knocked into the air.',
  manaCost: 3,
  cooldown: 3,
  targeting: 'enemy',
  range: 8,
  damage: 0,
  cast(ctx, target) {
    if (target.kind !== 'enemy') return;
    const enemy = ctx.state.enemies.find((e) => e.id === target.enemyId);
    if (!enemy || enemy.currentHp <= 0) return;
    startImmolate(ctx.state, enemy);
    ctx.log(`${enemy.name} is Immolated!`, 'combat');
  },
};
