import { macroCellOfNode } from '@/calculations/subGrid';
import type { Cell } from '@/model/types';
import type { SpellCastContext } from '../types';
import { DEADWEIGHT_BASE_DAMAGE, DEADWEIGHT_DAMAGE_PER_SOAK } from './constants';
import { applyDeadweightSlow, getSoak } from './soak';

export function deadweightDamage(soak: number): number {
  return Math.round(DEADWEIGHT_BASE_DAMAGE + soak * DEADWEIGHT_DAMAGE_PER_SOAK);
}

export function castDeadweight(ctx: SpellCastContext, center: Cell): void {
  let hit = 0;
  for (const enemy of ctx.state.enemies) {
    if (enemy.currentHp <= 0) continue;
    const macro = macroCellOfNode(enemy.pos);
    if (macro.col !== center.col || macro.row !== center.row) continue;
    const soak = getSoak(enemy);
    const dmg = deadweightDamage(soak);
    ctx.damageEnemy(enemy, dmg);
    applyDeadweightSlow(ctx.state, enemy);
    hit += 1;
  }
  if (hit > 0) {
    ctx.log(`Deadweight crushes ${hit} waterlogged ${hit === 1 ? 'foe' : 'foes'}.`, 'combat');
  } else {
    ctx.log('Deadweight finds no target in that cell.', 'combat');
  }
}
