import type { SpellDef } from './types';
import { queueBoulder } from './earth/boulder';

export const boulder: SpellDef = {
  id: 'boulder',
  name: 'Boulder',
  glyph: 'B',
  description: 'Lob a delayed smash. Spends all Charge. Misses tumble until they crash.',
  manaCost: 3,
  cooldown: 3,
  targeting: 'gridPoint',
  range: 10,
  damage: 0,
  aoeRadius: 0,
  cast(ctx, target) {
    if (target.kind !== 'cell') return;
    const spent = queueBoulder(ctx.state, target.cell);
    ctx.log(`Boulder aloft (${spent} Charge)!`, 'combat');
  },
};
