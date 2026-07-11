import type { SpellDef } from './types';
import { addKindlingPatch } from './fire/kindling';

export const kindling: SpellDef = {
  id: 'kindling',
  name: 'Kindling',
  glyph: 'K',
  description: 'Place a visible trap beside the tower. Stepping on it marks the enemy Kindled for 15s.',
  manaCost: 2,
  cooldown: 3,
  targeting: 'trapAdjacent',
  range: 8,
  damage: 0,
  cast(ctx, target) {
    if (target.kind !== 'cell') return;
    addKindlingPatch(ctx.state, target.cell);
    ctx.log('Kindling trap armed.', 'combat');
  },
};
