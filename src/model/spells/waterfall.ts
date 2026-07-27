import type { SpellDef } from './types';
import { castWaterfall } from './water/waterfall';

export const waterfall: SpellDef = {
  id: 'waterfall',
  name: 'Waterfall',
  glyph: 'W',
  description:
    'Continuous stream down the face (up to 10 cells). Washes climbers down, pools at the bottom, then fades from the top.',
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
