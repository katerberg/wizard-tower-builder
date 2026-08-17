import { macroCellOfNode } from '@/calculations/subGrid';
import { getSolarCollectorPosition } from '@/model/wizard';
import type { SpellCastContext, SpellDef } from '../types';
import type { Cell } from '../../types';

function cellsInAoE(center: Cell, radius: number): Cell[] {
  const cells: Cell[] = [];
  for (let dc = -radius; dc <= radius; dc++) {
    for (let dr = -radius; dr <= radius; dr++) {
      cells.push({ col: center.col + dc, row: center.row + dr });
    }
  }
  return cells;
}

function enemiesInCells(ctx: SpellCastContext, cells: Cell[]) {
  const keys = new Set(cells.map((c) => `${c.col},${c.row}`));
  return ctx.state.enemies.filter((enemy) => {
    if (enemy.currentHp <= 0) return false;
    const macro = macroCellOfNode(enemy.pos);
    return keys.has(`${macro.col},${macro.row}`);
  });
}

export function aoeCells(center: Cell, radius: number): Cell[] {
  return cellsInAoE(center, radius);
}

export function enemiesInFireballBlast(ctx: SpellCastContext, center: Cell): ReturnType<typeof enemiesInCells> {
  return enemiesInCells(ctx, cellsInAoE(center, 1));
}

function collectorInCells(ctx: SpellCastContext, cells: Cell[]): boolean {
  const collectorMacro = macroCellOfNode(getSolarCollectorPosition(ctx.state));
  return cells.some((c) => c.col === collectorMacro.col && c.row === collectorMacro.row);
}

export const fireball: SpellDef = {
  id: 'fireball',
  name: 'Fireball',
  glyph: '*',
  description: 'Instant 3×3 blast. Damages enemies — and the solar collector if caught in the blast. Procs Kindled.',
  manaCost: 4,
  cooldown: 2,
  targeting: 'gridPoint',
  range: 8,
  aoeRadius: 1,
  damage: 12,
  previewCells: (_state, cell) => aoeCells(cell, fireball.aoeRadius ?? 1),
  cast(ctx, target) {
    if (target.kind !== 'cell') return;
    const blastCells = cellsInAoE(target.cell, 1);
    const hit = enemiesInCells(ctx, blastCells);
    for (const enemy of hit) {
      ctx.applyFireDamage(enemy, fireball.damage);
    }
    if (collectorInCells(ctx, blastCells)) {
      ctx.damageCollector(fireball.damage);
    }
    if (hit.length > 0) {
      ctx.log(`Fireball scorches ${hit.length} ${hit.length === 1 ? 'foe' : 'foes'}.`, 'combat');
    } else if (!collectorInCells(ctx, blastCells)) {
      ctx.log('Fireball detonates — no enemies caught in the blast.', 'combat');
    }
  },
};
