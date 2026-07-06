import { faceOf } from '../../calculations/exteriorGraph';
import type { SpellDef } from './types';
import { WALL_OF_FLAME_DURATION } from './fire/constants';
import { addWallOfFlameSegment } from './fire/tick';
import { gridLine, sameFaceEndpoints } from './fire/wall';

export const wallOfFlame: SpellDef = {
  id: 'wallOfFlame',
  name: 'Wall of Flame',
  glyph: 'W',
  description: 'Draw a 5-cell flame lane on one face. Damages on enter and while inside — wizard included.',
  manaCost: 5,
  cooldown: 4,
  targeting: 'segment',
  range: 8,
  damage: 0,
  cast(ctx, target) {
    if (target.kind !== 'segment') return;
    const cells = gridLine(target.from, target.to);
    if (!cells) return;
    const face = faceOf(ctx.state.tower, target.from.col, target.from.row);
    addWallOfFlameSegment(ctx.state, {
      cells,
      face,
      expiresAt: ctx.state.waveTimer + WALL_OF_FLAME_DURATION,
    });
    ctx.log(`Wall of Flame ignites (${cells.length} cells).`, 'combat');
  },
};

export { gridLine, sameFaceEndpoints };
