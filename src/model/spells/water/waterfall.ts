import { faceOf, isWalkable } from '@/calculations/exteriorGraph';
import { SUB_CELLS_PER_MACRO } from '@/config/constants';
import { macroCellOfNode } from '@/calculations/subGrid';
import { getEnemyTemplate } from '@/model/enemies';
import type { ActiveWaterfall, Cell, GameState, MovementProfile } from '@/model/types';
import type { SpellCastContext, SpellDef } from '../types';
import {
  SHEET_FLOW_INTERVAL,
  WATERFALL_MAX_CELLS,
  WATERFALL_PUDDLE_LIFETIME,
} from './constants';
import { addPuddle, ensureWetCells, waterfallPath } from './wetCells';

const CRAWLER_PROFILE: MovementProfile = {
  kind: 'surface_climb',
  canFly: false,
  canPassUnderOverhang: true,
  canAttackOverhang: false,
  canTransferFaces: true,
};

function ensureActiveWaterfalls(state: GameState): ActiveWaterfall[] {
  if (!state.activeWaterfalls) state.activeWaterfalls = [];
  return state.activeWaterfalls;
}

export function resetActiveWaterfalls(state: GameState): void {
  state.activeWaterfalls = [];
  // Drop pinned stream sheets; leave hydrant sheets / puddles.
  state.wetCells = ensureWetCells(state).filter((w) => !w.stream);
}

/** Macro rows currently occupied by this waterfall stream. */
export function waterfallWetRows(wf: ActiveWaterfall): number[] {
  if (wf.top > wf.front) return [];
  return wf.rows.slice(wf.top, wf.front + 1);
}

/** Wash attached climbers one macro step down (no knock-off). */
export function shoveClimbersOnRows(
  state: GameState,
  col: number,
  rows: ReadonlySet<number>,
): void {
  for (const enemy of state.enemies) {
    if (enemy.currentHp <= 0) continue;
    const template = getEnemyTemplate(enemy.templateId);
    if (template?.movement.canFly) continue;
    const macro = macroCellOfNode(enemy.pos);
    if (macro.col !== col || !rows.has(macro.row)) continue;

    const profile = template?.movement ?? CRAWLER_PROFILE;
    const nextRow = enemy.pos.row - SUB_CELLS_PER_MACRO;
    if (nextRow < 0) continue;
    if (!isWalkable(state.tower, enemy.pos.col, nextRow, profile)) continue;
    enemy.pos = {
      ...enemy.pos,
      row: nextRow,
      face: faceOf(state.tower, enemy.pos.col, nextRow),
    };
    enemy.path = [];
    enemy.pathIndex = 0;
    enemy.pathGoalKey = undefined;
  }
}

function paintWaterfallStreams(state: GameState): void {
  const kept = ensureWetCells(state).filter((w) => !w.stream);
  for (const wf of ensureActiveWaterfalls(state)) {
    for (const row of waterfallWetRows(wf)) {
      const existing = kept.find((w) => w.col === wf.col && w.row === row);
      if (existing?.kind === 'puddle') continue;
      kept.push({
        col: wf.col,
        row,
        kind: 'sheet',
        lifetime: 1,
        stream: true,
      });
    }
  }
  state.wetCells = kept;
}

/**
 * Grow streams downward, wash climbers on the wet column, then fade from the top.
 * Call once per attack tick (after hydrant spray, with wet-cell tick).
 */
export function tickActiveWaterfalls(state: GameState, dt: number): void {
  const list = ensureActiveWaterfalls(state);
  if (list.length === 0) {
    // Still strip stale stream sheets if any.
    if (ensureWetCells(state).some((w) => w.stream)) {
      state.wetCells = state.wetCells.filter((w) => !w.stream);
    }
    return;
  }

  const remaining: ActiveWaterfall[] = [];

  for (const wf of list) {
    wf.flowAcc += dt;
    while (wf.flowAcc >= SHEET_FLOW_INTERVAL) {
      wf.flowAcc -= SHEET_FLOW_INTERVAL;

      const wet = new Set(waterfallWetRows(wf));
      shoveClimbersOnRows(state, wf.col, wet);

      if (wf.phase === 'growing') {
        if (wf.front < wf.rows.length - 1) {
          wf.front += 1;
        } else {
          const bottom = wf.rows[wf.rows.length - 1];
          addPuddle(state, wf.col, bottom, WATERFALL_PUDDLE_LIFETIME);
          wf.phase = 'fading';
        }
      } else {
        wf.top += 1;
      }
    }

    if (wf.top <= wf.front) {
      remaining.push(wf);
    }
  }

  state.activeWaterfalls = remaining;
  paintWaterfallStreams(state);
}

/**
 * Cast Waterfall: start a continuous stream that grows down the column,
 * washes climbers with it, pools at the stop, then fades from the top.
 */
export function castWaterfall(ctx: SpellCastContext, start: Cell): void {
  const path = waterfallPath(ctx.state.tower, start, WATERFALL_MAX_CELLS);
  if (path.length === 0) {
    ctx.log('Waterfall finds no open face to run down.', 'combat');
    return;
  }

  const wf: ActiveWaterfall = {
    col: path[0].col,
    rows: path.map((c) => c.row),
    front: 0,
    top: 0,
    phase: 'growing',
    flowAcc: 0,
  };
  ensureActiveWaterfalls(ctx.state).push(wf);
  paintWaterfallStreams(ctx.state);

  ctx.log('Waterfall sheets down the face.', 'combat');
}

export function waterfallPreviewCells(tower: GameState['tower'], start: Cell): Cell[] {
  return waterfallPath(tower, start, WATERFALL_MAX_CELLS);
}

export const waterfall: SpellDef = {
  id: 'waterfall',
  name: 'Waterfall',
  glyph: 'W',
  description:
    'Continuous stream down the face (up to 10 cells). Washes climbers down, pools at the bottom, then fades from the top.',
  manaCost: 4,
  cooldown: 4,
  targeting: 'gridPoint',
  range: 10,
  damage: 0,
  previewCells: (state, cell) => waterfallPreviewCells(state.tower, cell),
  cast(ctx, target) {
    if (target.kind !== 'cell') return;
    castWaterfall(ctx, target.cell);
  },
};
