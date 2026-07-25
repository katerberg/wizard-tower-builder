import type { SpellDef } from './types';
import { castWaterfall } from './water/waterfall';

export const waterfall: SpellDef = {
  id: 'waterfall',
  name: 'Waterfall',
  glyph: 'W',
  description:
    'Water runs down the face (up to 10 cells), washes climbers down while they hang on, and leaves a puddle.',
  manaCost: 4,
  cooldown: 4,
  targeting: 'gridPoint',
  range: 10,
  damage: 0,
  cast(ctx, target) {
    if (target.kind !== 'cell') return;
    castWaterfall(ctx, target.cell);
  },
};
