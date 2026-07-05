import type { SpellCastContext, SpellDef } from './types';
import type { Cell } from '../types';
import { getWizardPosition } from '../tower';

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
  return ctx.state.enemies.filter(
    (enemy) => enemy.currentHp > 0 && keys.has(`${enemy.pos.col},${enemy.pos.row}`),
  );
}

export function aoeCells(center: Cell, radius: number): Cell[] {
  return cellsInAoE(center, radius);
}

export function enemiesInFireballBlast(ctx: SpellCastContext, center: Cell): ReturnType<typeof enemiesInCells> {
  return enemiesInCells(ctx, cellsInAoE(center, 1));
}

function wizardInCells(ctx: SpellCastContext, cells: Cell[]): boolean {
  const wizardPos = getWizardPosition(ctx.state.tower);
  return cells.some((c) => c.col === wizardPos.col && c.row === wizardPos.row);
}

export const fireball: SpellDef = {
  id: 'fireball',
  name: 'Fireball',
  glyph: '*',
  description: 'Instant 3×3 blast. Damages enemies — and the wizard if caught in the blast.',
  manaCost: 4,
  cooldown: 2,
  targeting: 'gridPoint',
  range: 8,
  aoeRadius: 1,
  damage: 12,
  cast(ctx, target) {
    const blastCells = cellsInAoE(target.cell, 1);
    const hit = enemiesInCells(ctx, blastCells);
    for (const enemy of hit) {
      ctx.damageEnemy(enemy, fireball.damage);
    }
    if (wizardInCells(ctx, blastCells)) {
      ctx.damageWizard(fireball.damage);
    }
    if (hit.length > 0) {
      ctx.log(`Fireball scorches ${hit.length} ${hit.length === 1 ? 'foe' : 'foes'}.`, 'combat');
    } else if (!wizardInCells(ctx, blastCells)) {
      ctx.log('Fireball detonates — no enemies caught in the blast.', 'combat');
    }
  },
};
