import { macroCellOfNode } from '@/calculations/subGrid';
import type { Cell } from '@/model/types';
import type { SpellCastContext, SpellDef } from '../types';
import { DEADWEIGHT_AOE_RADIUS, DEADWEIGHT_BASE_DAMAGE, DEADWEIGHT_DAMAGE_PER_SOAK } from './constants';
import { applyDeadweightSlow, getSoak } from './soak';
import { splashCells } from './splash';

export function deadweightDamage(soak: number): number {
  return Math.round(DEADWEIGHT_BASE_DAMAGE + soak * DEADWEIGHT_DAMAGE_PER_SOAK);
}

export function deadweightCells(center: Cell, radius = DEADWEIGHT_AOE_RADIUS): Cell[] {
  return splashCells(center, radius);
}

export function castDeadweight(ctx: SpellCastContext, center: Cell): void {
  const keys = new Set(deadweightCells(center).map((c) => `${c.col},${c.row}`));
  let hit = 0;
  for (const enemy of ctx.state.enemies) {
    if (enemy.currentHp <= 0) continue;
    const macro = macroCellOfNode(enemy.pos);
    if (!keys.has(`${macro.col},${macro.row}`)) continue;
    const soak = getSoak(enemy);
    const dmg = deadweightDamage(soak);
    ctx.damageEnemy(enemy, dmg);
    applyDeadweightSlow(ctx.state, enemy);
    hit += 1;
  }
  if (hit > 0) {
    ctx.log(`Deadweight crushes ${hit} waterlogged ${hit === 1 ? 'foe' : 'foes'}.`, 'combat');
  } else {
    ctx.log('Deadweight finds no target in that space.', 'combat');
  }
}

export const deadweight: SpellDef = {
  id: 'deadweight',
  name: 'Deadweight',
  glyph: 'D',
  description:
    '3×3 crush. Damage scales with real Soak; briefly heavier slow (fake +Soak for speed only).',
  manaCost: 3,
  cooldown: 3,
  targeting: 'gridPoint',
  range: 8,
  aoeRadius: DEADWEIGHT_AOE_RADIUS,
  damage: 3,
  previewCells: (_state, cell) => deadweightCells(cell),
  cast(ctx, target) {
    if (target.kind !== 'cell') return;
    castDeadweight(ctx, target.cell);
  },
};
