import { cellKey } from '@/calculations/grid';
import { macroCellOfNode } from '@/calculations/subGrid';
import { addMessage } from '@/model/messages';
import type { Cell, Enemy, GameState, PendingBoulder } from '@/model/types';
import type { SpellCastContext } from '../types';
import {
  BOULDER_CRASH_DAMAGE_PER_CHARGE,
  BOULDER_DAMAGE_PER_CHARGE,
  BOULDER_DELAY,
} from './constants';
import { ensureEarthState, spendAllCharge } from './charge';

function enemiesAtMacro(state: GameState, cell: Cell): Enemy[] {
  return state.enemies.filter((e) => {
    if (e.currentHp <= 0) return false;
    const m = macroCellOfNode(e.pos);
    return m.col === cell.col && m.row === cell.row;
  });
}

function roomOccupiesCell(state: GameState, cell: Cell): boolean {
  return Object.prototype.hasOwnProperty.call(state.tower.occupancy, cellKey(cell.col, cell.row));
}

export function queueBoulder(state: GameState, aim: Cell): number {
  ensureEarthState(state);
  const spent = spendAllCharge(state);
  const boulder: PendingBoulder = {
    aimCol: aim.col,
    aimRow: aim.row,
    chargeSpent: spent,
    impactAt: state.waveTimer + BOULDER_DELAY,
    phase: 'aimed',
    col: aim.col,
    row: aim.row + 3,
  };
  state.pendingBoulders.push(boulder);
  return spent;
}

function crashBoulder(
  state: GameState,
  boulder: PendingBoulder,
  cell: Cell,
  ctx: SpellCastContext,
): void {
  const damage = Math.max(1, boulder.chargeSpent * BOULDER_CRASH_DAMAGE_PER_CHARGE);
  const hit = enemiesAtMacro(state, cell);
  for (const enemy of hit) {
    ctx.damageEnemy(enemy, damage);
  }
  if (hit.length === 0 && roomOccupiesCell(state, cell)) {
    addMessage(state, `Boulder crashes into the tower at (${cell.col},${cell.row}).`, 'combat');
  } else if (hit.length > 0) {
    addMessage(state, `Boulder crashes into ${hit.length} foe(s)!`, 'combat');
  } else {
    addMessage(state, 'Boulder smashes into the ground.', 'combat');
  }
}

function impactBoulder(state: GameState, boulder: PendingBoulder, ctx: SpellCastContext): boolean {
  const aim = { col: boulder.aimCol, row: boulder.aimRow };
  const hit = enemiesAtMacro(state, aim);
  if (hit.length > 0) {
    const damage = Math.max(1, boulder.chargeSpent * BOULDER_DAMAGE_PER_CHARGE);
    for (const enemy of hit) {
      ctx.damageEnemy(enemy, damage);
    }
    addMessage(state, `Boulder smashes ${hit.length} foe(s) (${boulder.chargeSpent} Charge)!`, 'combat');
    return true;
  }
  // Miss — begin falling at an angle (down + sideways).
  boulder.phase = 'falling';
  boulder.col = aim.col;
  boulder.row = aim.row;
  const roll = state.rngState % 2;
  state.rngState = (state.rngState * 1103515245 + 12345) >>> 0;
  boulder.fallDir = roll === 0 ? -1 : 1;
  addMessage(state, 'Boulder misses and tumbles downward!', 'combat');
  return false;
}

export function tickBoulders(state: GameState, _dt: number, ctx: SpellCastContext): void {
  ensureEarthState(state);
  const remaining: PendingBoulder[] = [];

  for (const boulder of state.pendingBoulders) {
    if (boulder.phase === 'aimed') {
      if (state.waveTimer < boulder.impactAt) {
        remaining.push(boulder);
        continue;
      }
      const resolved = impactBoulder(state, boulder, ctx);
      if (!resolved) remaining.push(boulder);
      continue;
    }

    // Falling: step diagonally down each half-second of wave time via impactAt as next-step timer
    if (boulder.nextFallAt == null) {
      boulder.nextFallAt = state.waveTimer + 0.15;
      remaining.push(boulder);
      continue;
    }
    if (state.waveTimer < boulder.nextFallAt) {
      remaining.push(boulder);
      continue;
    }

    const dir = boulder.fallDir ?? 1;
    const next = { col: boulder.col + dir, row: boulder.row - 1 };
    boulder.col = next.col;
    boulder.row = next.row;
    boulder.nextFallAt = state.waveTimer + 0.15;

    if (next.row < 0) {
      crashBoulder(state, boulder, { col: next.col, row: 0 }, ctx);
      continue;
    }

    const foes = enemiesAtMacro(state, next);
    if (foes.length > 0 || roomOccupiesCell(state, next)) {
      crashBoulder(state, boulder, next, ctx);
      continue;
    }

    remaining.push(boulder);
  }

  state.pendingBoulders = remaining;
}

export function previewBoulderLanding(aim: Cell): Cell {
  return aim;
}
