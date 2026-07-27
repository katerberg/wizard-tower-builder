import type { SpellDef } from './types';
import { SPLASH_AOE_RADIUS } from './water/constants';
import { castSplash } from './water/splash';

export const splash: SpellDef = {
  id: 'splash',
  name: 'Splash',
  glyph: '~',
  description: 'Small AoE soak. No damage — wets climbers so Deadweight and Geyser can bite.',
  manaCost: 2,
  cooldown: 2,
  targeting: 'gridPoint',
  range: 8,
  aoeRadius: SPLASH_AOE_RADIUS,
  damage: 0,
  cast(ctx, target) {
    if (target.kind !== 'cell') return;
    castSplash(ctx, target.cell);
  },
};
