import type { SpellDef } from './types';
import { castGeyser } from './water/geyser';

export const geyser: SpellDef = {
  id: 'geyser',
  name: 'Geyser',
  glyph: '^',
  description:
    'Erupt from a puddle: blast up 3 cells. Damages damp+ foes; soaks everyone hit. Needs a puddle.',
  manaCost: 4,
  cooldown: 5,
  targeting: 'puddle',
  range: 10,
  damage: 12,
  cast(ctx, target) {
    if (target.kind !== 'cell') return;
    castGeyser(ctx, target.cell);
  },
};
