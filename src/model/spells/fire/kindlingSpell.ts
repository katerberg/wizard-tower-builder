import { isKindlingTrapCell, placeKindlingPatch } from './kindling';
import type { SpellDef } from '../types';

export const kindling: SpellDef = {
  id: 'kindling',
  name: 'Kindling',
  glyph: '.',
  description: 'Place a 15s trap beside the wall. Foes that cross it become Kindled.',
  manaCost: 2,
  cooldown: 4,
  targeting: 'kindlingTrap',
  range: 8,
  damage: 0,
  cast(ctx, target) {
    if (target.kind !== 'cell') return;
    if (!isKindlingTrapCell(ctx.state.tower, target.cell)) return;
    if (!placeKindlingPatch(ctx.state, target.cell)) return;
    ctx.log('Kindling laid — awaiting a spark.', 'combat');
  },
};
