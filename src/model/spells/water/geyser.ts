import { macroCellOfNode } from '@/calculations/subGrid';
import { getSolarCollectorPosition } from '@/model/wizard';
import type { Cell, GameState } from '@/model/types';
import type { SpellCastContext, SpellDef } from '../types';
import { GEYSER_DAMAGE, GEYSER_SOAK, GEYSER_UP_CELLS, GEYSER_WIZARD_DAMAGE } from './constants';
import { addSoak, isDampOrWetter } from './soak';
import { isPuddleCell } from './wetCells';

export function isValidGeyserPlacement(state: GameState, cell: Cell): boolean {
  return isPuddleCell(state, cell.col, cell.row);
}

export function geyserColumnCells(puddle: Cell): Cell[] {
  const cells: Cell[] = [puddle];
  for (let i = 1; i <= GEYSER_UP_CELLS; i++) {
    cells.push({ col: puddle.col, row: puddle.row + i });
  }
  return cells;
}

export function castGeyser(ctx: SpellCastContext, puddle: Cell): void {
  if (!isPuddleCell(ctx.state, puddle.col, puddle.row)) {
    ctx.log('Geyser needs a puddle to erupt from.', 'combat');
    return;
  }

  const column = geyserColumnCells(puddle);
  const keys = new Set(column.map((c) => `${c.col},${c.row}`));
  let damaged = 0;
  let soaked = 0;

  for (const enemy of ctx.state.enemies) {
    if (enemy.currentHp <= 0) continue;
    const macro = macroCellOfNode(enemy.pos);
    if (!keys.has(`${macro.col},${macro.row}`)) continue;

    const wasDamp = isDampOrWetter(enemy);
    addSoak(enemy, GEYSER_SOAK);
    soaked += 1;
    if (wasDamp) {
      ctx.damageEnemy(enemy, GEYSER_DAMAGE);
      damaged += 1;
    }
  }

  const collectorMacro = macroCellOfNode(getSolarCollectorPosition(ctx.state));
  if (keys.has(`${collectorMacro.col},${collectorMacro.row}`)) {
    ctx.damageWizard(GEYSER_WIZARD_DAMAGE);
  }

  if (damaged > 0 || soaked > 0) {
    ctx.log(
      `Geyser erupts — soaks ${soaked}, batters ${damaged} damp ${damaged === 1 ? 'foe' : 'foes'}.`,
      'combat',
    );
  } else {
    ctx.log('Geyser blasts upward — empty air.', 'combat');
  }
}

export const geyser: SpellDef = {
  id: 'geyser',
  name: 'Geyser',
  glyph: '^',
  description:
    'Erupt from a puddle: blast up 3 cells. Damages damp+ foes; soaks everyone hit. Needs a puddle.',
  manaCost: 4,
  cooldown: 5,
  targeting: 'puddle',
  range: 10,
  damage: 12,
  validatePlacement: (state, cell) => isValidGeyserPlacement(state, cell),
  previewCells: (_state, cell) => geyserColumnCells(cell),
  cast(ctx, target) {
    if (target.kind !== 'cell') return;
    castGeyser(ctx, target.cell);
  },
};
