import { macroCellOfNode } from '@/calculations/subGrid';
import type { Cell } from '@/model/types';
import type { SpellCastContext, SpellDef } from '../types';
import { SPLASH_AOE_RADIUS, SPLASH_SOAK } from './constants';
import { addSoak } from './soak';

export function splashCells(center: Cell, radius = SPLASH_AOE_RADIUS): Cell[] {
  const cells: Cell[] = [];
  for (let dc = -radius; dc <= radius; dc++) {
    for (let dr = -radius; dr <= radius; dr++) {
      cells.push({ col: center.col + dc, row: center.row + dr });
    }
  }
  return cells;
}

export function castSplash(ctx: SpellCastContext, center: Cell): void {
  const cells = splashCells(center);
  const keys = new Set(cells.map((c) => `${c.col},${c.row}`));
  let hit = 0;
  for (const enemy of ctx.state.enemies) {
    if (enemy.currentHp <= 0) continue;
    const macro = macroCellOfNode(enemy.pos);
    if (!keys.has(`${macro.col},${macro.row}`)) continue;
    addSoak(enemy, SPLASH_SOAK);
    hit += 1;
  }
  if (hit > 0) {
    ctx.log(`Splash soaks ${hit} ${hit === 1 ? 'foe' : 'foes'}.`, 'combat');
  } else {
    ctx.log('Splash spatters — no one in the spray.', 'combat');
  }
}

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
  previewCells: (_state, cell) => splashCells(cell),
  cast(ctx, target) {
    if (target.kind !== 'cell') return;
    castSplash(ctx, target.cell);
  },
};
