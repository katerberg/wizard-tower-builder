import type { SpellDef } from './types';
import { castDeadweight } from './water/deadweight';

export const deadweight: SpellDef = {
  id: 'deadweight',
  name: 'Deadweight',
  glyph: 'D',
  description:
    'Crush a cell. Damage scales with real Soak; briefly heavier slow (fake +Soak for speed only).',
  manaCost: 3,
  cooldown: 3,
  targeting: 'gridPoint',
  range: 8,
  damage: 3,
  cast(ctx, target) {
    if (target.kind !== 'cell') return;
    castDeadweight(ctx, target.cell);
  },
};
