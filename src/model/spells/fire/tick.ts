import { macroCellOfNode } from '../../../calculations/subGrid';
import { getWizardPosition } from '../../tower';
import type { GameState, WallOfFlameSegment } from '../../types';
import type { SpellCastContext } from '../types';
import {
  WALL_OF_FLAME_ENTER_DAMAGE,
  WALL_OF_FLAME_TICK_DAMAGE,
  WALL_OF_FLAME_TICK_INTERVAL,
} from './constants';
import { applyFireDamage } from './fireDamage';
import { tickImmolate } from './immolate';
import { tickKindledTimers } from './kindled';
import { tickKindlingPatches } from './kindling';
import { ensureFireState, segmentContainsCell, segmentKey } from './wall';

export function resetFireState(state: GameState): void {
  state.kindlingPatches = [];
  state.wallOfFlameSegments = [];
  state.fireEnterDone = {};
  for (const enemy of state.enemies) {
    delete enemy.kindledUntil;
    delete enemy.immolateUntil;
    delete enemy.immolateDistanceBurned;
    delete enemy.immolateTickTimer;
    delete enemy.wallFlameInside;
  }
}

export function tickFireEffects(
  state: GameState,
  dt: number,
  buildCtx: (spellName: string) => SpellCastContext,
): void {
  ensureFireState(state);
  tickKindlingPatches(state);
  tickKindledTimers(state);
  tickImmolate(state, dt, buildCtx);
  tickWallOfFlame(state, dt, buildCtx);
}

function tickWallOfFlame(state: GameState, dt: number, buildCtx: (spellName: string) => SpellCastContext): void {
  const wizardPos = getWizardPosition(state.tower);

  state.wallOfFlameSegments = state.wallOfFlameSegments.filter((seg) => seg.expiresAt > state.waveTimer);

  state.wallOfFlameSegments.forEach((segment, index) => {
    segment.tickTimer += dt;
    const key = segmentKey(segment, index);
    const ctx = buildCtx('Wall of Flame');

    for (const enemy of state.enemies) {
      if (enemy.currentHp <= 0) continue;
      const enemyMacro = macroCellOfNode(enemy.pos);
      const inside = segmentContainsCell(segment, enemyMacro.col, enemyMacro.row);
      const insideKeys = enemy.wallFlameInside ?? [];
      const wasInside = insideKeys.includes(key);

      if (inside && !wasInside) {
        const enterKey = `${key}:${enemy.id}`;
        if (!state.fireEnterDone[enterKey]) {
          state.fireEnterDone[enterKey] = true;
          applyFireDamage(ctx, enemy, WALL_OF_FLAME_ENTER_DAMAGE);
        }
        enemy.wallFlameInside = [...insideKeys, key];
      } else if (!inside && wasInside) {
        enemy.wallFlameInside = insideKeys.filter((k) => k !== key);
      }
    }

    const wizardMacro = macroCellOfNode(wizardPos);
    const wizardInside = segmentContainsCell(segment, wizardMacro.col, wizardMacro.row);
    const wizardEnterKey = `${key}:wizard`;
    if (wizardInside && !state.fireEnterDone[wizardEnterKey]) {
      state.fireEnterDone[wizardEnterKey] = true;
      ctx.damageWizard(WALL_OF_FLAME_ENTER_DAMAGE);
    }

    if (segment.tickTimer < WALL_OF_FLAME_TICK_INTERVAL) return;
    segment.tickTimer -= WALL_OF_FLAME_TICK_INTERVAL;

    for (const enemy of state.enemies) {
      if (enemy.currentHp <= 0) continue;
      const enemyMacro = macroCellOfNode(enemy.pos);
      if (!segmentContainsCell(segment, enemyMacro.col, enemyMacro.row)) continue;
      applyFireDamage(ctx, enemy, WALL_OF_FLAME_TICK_DAMAGE);
    }

    if (wizardInside) {
      ctx.damageWizard(WALL_OF_FLAME_TICK_DAMAGE);
    }
  });
}

export function addWallOfFlameSegment(
  state: GameState,
  segment: Omit<WallOfFlameSegment, 'tickTimer'>,
): void {
  ensureFireState(state);
  state.wallOfFlameSegments.push({ ...segment, tickTimer: 0 });
}
