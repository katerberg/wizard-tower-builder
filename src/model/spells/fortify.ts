import type { SpellDef } from './types';
import { startFortify } from './earth/fortify';

export const fortify: SpellDef = {
  id: 'fortify',
  name: 'Fortify',
  glyph: 'O',
  description: 'Concentrate: take 25% damage, gain Charge, cannot cast until you go.',
  manaCost: 1,
  cooldown: 2,
  targeting: 'self',
  range: 0,
  damage: 0,
  cast(ctx) {
    startFortify(ctx.state);
  },
};
