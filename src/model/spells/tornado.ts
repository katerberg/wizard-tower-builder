import type { SpellDef } from './types';
import { TORNADO_DURATION } from './air/constants';
import { addTornadoSegment } from './air/tick';
import { tornadoGridLine } from './air/tornado';

export const tornado: SpellDef = {
  id: 'tornado',
  name: 'Tornado',
  glyph: 'T',
  description: 'Draw a 2-high blocking wind lane in the air. Ejects intruders — wizard included.',
  manaCost: 5,
  cooldown: 4,
  targeting: 'airSegment',
  range: 8,
  damage: 0,
  cast(ctx, target) {
    if (target.kind !== 'segment') return;
    const cells = tornadoGridLine(target.from, target.to);
    if (!cells) return;
    addTornadoSegment(ctx.state, {
      macroCells: cells,
      expiresAt: ctx.state.waveTimer + TORNADO_DURATION,
    });
    ctx.log(`Tornado spins up (${cells.length} columns).`, 'combat');
  },
};

export { tornadoGridLine };
