import type { SpellDef } from './types';
import { castEarthquake, roomIdAtCell } from './earth/earthquake';

export const earthquake: SpellDef = {
  id: 'earthquake',
  name: 'Earthquake',
  glyph: 'E',
  description: 'Crack a spine to a tip room. Damages path rooms (~⅓ HP) and climbers; dumps all Charge.',
  manaCost: 4,
  cooldown: 8,
  targeting: 'room',
  range: 12,
  damage: 0,
  cast(ctx, target) {
    if (target.kind !== 'cell') return;
    const roomId = roomIdAtCell(ctx.state.tower, target.cell);
    if (!roomId) return;
    castEarthquake(ctx.state, roomId, ctx);
  },
};

export { roomIdAtCell };
