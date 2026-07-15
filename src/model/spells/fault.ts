import type { SpellDef } from './types';
import { addFaultPatch } from './earth/fault';

export const fault: SpellDef = {
  id: 'fault',
  name: 'Fault',
  glyph: 'F',
  description: 'Scar a climb tile. Each enemy pass feeds Charge.',
  manaCost: 2,
  cooldown: 4,
  targeting: 'trapAdjacent',
  range: 8,
  damage: 0,
  cast(ctx, target) {
    if (target.kind !== 'cell') return;
    addFaultPatch(ctx.state, target.cell);
    ctx.log('Fault cracks the climb path.', 'combat');
  },
};
