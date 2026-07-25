import { faceOf, isWalkable } from '@/calculations/exteriorGraph';
import { SUB_CELLS_PER_MACRO } from '@/config/constants';
import { macroCellOfNode } from '@/calculations/subGrid';
import { getEnemyTemplate } from '@/model/enemies';
import type { Cell, Enemy, GameState, MovementProfile } from '@/model/types';
import type { SpellCastContext } from '../types';
import { WATERFALL_MAX_CELLS, WATERFALL_PUDDLE_LIFETIME } from './constants';
import { addPuddle, waterfallPath } from './wetCells';

const CRAWLER_PROFILE: MovementProfile = {
  kind: 'surface_climb',
  canFly: false,
  canPassUnderOverhang: true,
  canAttackOverhang: false,
  canTransferFaces: true,
};

function pathKeys(path: Cell[]): Set<string> {
  return new Set(path.map((c) => `${c.col},${c.row}`));
}

/** Slide an attached climber down macro rows without detaching (no fall damage). */
export function slideEnemyDown(
  state: GameState,
  enemy: Enemy,
  macroSteps: number,
  profile: MovementProfile = CRAWLER_PROFILE,
): number {
  if (macroSteps <= 0) return 0;
  let moved = 0;
  for (let i = 0; i < macroSteps; i++) {
    const nextRow = enemy.pos.row - SUB_CELLS_PER_MACRO;
    if (nextRow < 0) break;
    if (!isWalkable(state.tower, enemy.pos.col, nextRow, profile)) break;
    enemy.pos = {
      ...enemy.pos,
      row: nextRow,
      face: faceOf(state.tower, enemy.pos.col, nextRow),
    };
    moved += 1;
  }
  if (moved > 0) {
    enemy.path = [];
    enemy.pathIndex = 0;
    enemy.pathGoalKey = undefined;
  }
  return moved;
}

export function castWaterfall(ctx: SpellCastContext, start: Cell): void {
  const path = waterfallPath(ctx.state.tower, start, WATERFALL_MAX_CELLS);
  if (path.length === 0) {
    ctx.log('Waterfall finds no open face to run down.', 'combat');
    return;
  }

  const keys = pathKeys(path);
  const bottom = path[path.length - 1];
  let pushed = 0;

  for (const enemy of ctx.state.enemies) {
    if (enemy.currentHp <= 0) continue;
    const template = getEnemyTemplate(enemy.templateId);
    if (template?.movement.canFly) continue;
    const macro = macroCellOfNode(enemy.pos);
    if (!keys.has(`${macro.col},${macro.row}`)) continue;

    const idx = path.findIndex((c) => c.col === macro.col && c.row === macro.row);
    if (idx < 0) continue;
    const stepsDown = path.length - 1 - idx;
    const moved = slideEnemyDown(ctx.state, enemy, stepsDown, template?.movement ?? CRAWLER_PROFILE);
    if (moved > 0) pushed += 1;
  }

  addPuddle(ctx.state, bottom.col, bottom.row, WATERFALL_PUDDLE_LIFETIME);

  if (pushed > 0) {
    ctx.log(`Waterfall washes ${pushed} ${pushed === 1 ? 'foe' : 'foes'} down the tower.`, 'combat');
  } else {
    ctx.log('Waterfall sheets down the face and pools below.', 'combat');
  }
}

export function waterfallPreviewCells(tower: GameState['tower'], start: Cell): Cell[] {
  return waterfallPath(tower, start, WATERFALL_MAX_CELLS);
}
