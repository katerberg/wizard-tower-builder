import { addWallSegment, validateWallSegment } from './wallOfFlame';
import type { SpellDef } from '../types';

export const wallOfFlame: SpellDef = {
  id: 'wallOfFlame',
  name: 'Wall of Flame',
  glyph: '|',
  description: 'Draw a short flame wall (A→B). Damages all who pass; scorches the wizard too.',
  manaCost: 5,
  cooldown: 6,
  targeting: 'wallSegment',
  range: 10,
  damage: 0,
  cast(ctx, target) {
    if (target.kind !== 'segment') return;
    const valid = validateWallSegment(ctx.state.tower, target.a, target.b);
    if (!valid.ok) return;
    addWallSegment(ctx.state, valid.cells);
    ctx.log(`Wall of Flame rises (${valid.cells.length} cells).`, 'combat');
  },
};
