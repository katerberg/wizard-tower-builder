import type { SpellDef } from './types';
import { BLIZZARD_DURATION } from './air/constants';
import { addBlizzardZone } from './air/blizzard';

export const blizzard: SpellDef = {
  id: 'blizzard',
  name: 'Blizzard',
  glyph: 'B',
  description: 'Large slowing snowfield. Light wind damage — sets up Gust and Tornado.',
  manaCost: 4,
  cooldown: 3,
  targeting: 'gridPoint',
  range: 8,
  damage: 0,
  cast(ctx, target) {
    if (target.kind !== 'cell') return;
    addBlizzardZone(ctx.state, target.cell, ctx.state.waveTimer + BLIZZARD_DURATION);
    ctx.log('Blizzard howls across the approach.', 'combat');
  },
};
