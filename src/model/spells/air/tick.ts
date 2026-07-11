import { faceOf, surfaceContacts } from '../../../calculations/exteriorGraph';
import { macroCellOfNode } from '../../../calculations/subGrid';
import { getEffectiveWizardPosition } from './flight';
import type { Enemy, GameState, TornadoSegment } from '../../types';
import type { SpellCastContext } from '../types';
import {
  TORNADO_ENTER_DAMAGE,
  TORNADO_EJECT_SUB_CELLS,
  TORNADO_TICK_DAMAGE,
  TORNADO_TICK_INTERVAL,
  BLIZZARD_TICK_DAMAGE,
  BLIZZARD_TICK_INTERVAL,
  FLIGHT_DURATION,
} from './constants';
import { applyCollisionDamage, detachEnemy, tickAirborneEnemies, wasOnWall } from './fallCollision';
import { resolveSubCellDisplacement } from './displacement';
import { tickWizardFlight, clearWizardFlight } from './flight';
import { tickBlizzardZones, isInBlizzardZone } from './blizzard';
import { ensureAirState, isInTornadoVolume } from './tornado';
import { applyWindDamage } from './windDamage';
import { applyDiscombobulated } from './discombobulated';

const EJECT_DIRS = [
  { dc: 1, dr: 0 },
  { dc: -1, dr: 0 },
  { dc: 0, dr: 1 },
  { dc: 0, dr: -1 },
  { dc: 1, dr: 1 },
  { dc: 1, dr: -1 },
  { dc: -1, dr: 1 },
  { dc: -1, dr: -1 },
];

function pickEjectDir(state: GameState): { dc: number; dr: number } {
  const idx = state.rngState % EJECT_DIRS.length;
  state.rngState = (state.rngState * 1664525 + 1013904223) >>> 0;
  return EJECT_DIRS[idx];
}

function ejectEnemy(state: GameState, enemy: Enemy, source: string): void {
  const dir = pickEjectDir(state);
  const hadWall = wasOnWall(state.tower, enemy.pos);
  const push = resolveSubCellDisplacement(
    state.tower,
    enemy.pos,
    dir.dc,
    dir.dr,
    TORNADO_EJECT_SUB_CELLS,
  );

  enemy.pos = {
    ...enemy.pos,
    col: push.pos.col,
    row: push.pos.row,
    face: faceOf(state.tower, push.pos.col, push.pos.row),
  };
  enemy.path = [];
  enemy.pathIndex = 0;

  if (push.hitRoom) {
    applyCollisionDamage(state, enemy, source);
    if (hadWall) applyDiscombobulated(enemy);
    return;
  }

  const contacts = surfaceContacts(state.tower, enemy.pos.col, enemy.pos.row);
  if (contacts.size === 0) {
    if (hadWall) detachEnemy(state, enemy);
    return;
  }

  if (hadWall) {
    applyDiscombobulated(enemy);
  }
}

export function resetAirState(state: GameState): void {
  state.tornadoSegments = [];
  state.blizzardZones = [];
  state.tornadoEnterDone = {};
  clearWizardFlight(state);
  for (const enemy of state.enemies) {
    delete enemy.discombobulated;
    delete enemy.discombobulatedAttachReady;
    delete enemy.airborne;
    delete enemy.airborneFromRow;
    delete enemy.fallSubRows;
    delete enemy.airborneTimer;
    delete enemy.tornadoInside;
  }
}

export function isMacroCellBlockedByTornado(state: GameState, macroCol: number, macroRow: number): boolean {
  return isInTornadoVolume(state, macroCol, macroRow);
}

export function blizzardSlowMultiplier(state: GameState, enemy: Enemy): number {
  const macro = macroCellOfNode(enemy.pos);
  return isInBlizzardZone(state, macro.col, macro.row) ? 2 : 1;
}

export function tickAirEffects(
  state: GameState,
  dt: number,
  buildCtx: (spellName: string) => SpellCastContext,
): void {
  ensureAirState(state);
  tickBlizzardZones(state);
  tickWizardFlight(state, dt, FLIGHT_DURATION);

  tickAirborneEnemies(state, dt);

  state.tornadoSegments = state.tornadoSegments.filter((s) => s.expiresAt > state.waveTimer);

  const wizardPos = getEffectiveWizardPosition(state);
  const wizardMacro = macroCellOfNode(wizardPos);

  state.tornadoSegments.forEach((segment, segIndex) => {
    segment.tickTimer += dt;
    const ctx = buildCtx('Tornado');
    const segKey = `tornado:${segIndex}`;

    for (const enemy of state.enemies) {
      if (enemy.currentHp <= 0) continue;
      const macro = macroCellOfNode(enemy.pos);
      const inside = isInTornadoVolume(state, macro.col, macro.row);
      const insideKeys = enemy.tornadoInside ?? [];
      const wasInside = insideKeys.includes(segKey);

      if (inside && !wasInside) {
        const enterKey = `${segKey}:${enemy.id}`;
        if (!state.tornadoEnterDone[enterKey]) {
          state.tornadoEnterDone[enterKey] = true;
          applyWindDamage(ctx, enemy, TORNADO_ENTER_DAMAGE);
          ejectEnemy(state, enemy, 'Tornado');
        }
        enemy.tornadoInside = [...insideKeys, segKey];
      } else if (!inside && wasInside) {
        enemy.tornadoInside = insideKeys.filter((k) => k !== segKey);
      }
    }

    const wizardInside =
      segment.macroCells.some(
        (c) => c.col === wizardMacro.col && (c.row === wizardMacro.row || c.row + 1 === wizardMacro.row),
      );
    const wizEnterKey = `${segKey}:wizard`;
    if (wizardInside && !state.tornadoEnterDone[wizEnterKey]) {
      state.tornadoEnterDone[wizEnterKey] = true;
      ctx.damageWizard(TORNADO_ENTER_DAMAGE);
    }

    if (segment.tickTimer < TORNADO_TICK_INTERVAL) return;
    segment.tickTimer -= TORNADO_TICK_INTERVAL;

    for (const enemy of state.enemies) {
      if (enemy.currentHp <= 0) continue;
      const macro = macroCellOfNode(enemy.pos);
      if (!isInTornadoVolume(state, macro.col, macro.row)) continue;
      applyWindDamage(ctx, enemy, TORNADO_TICK_DAMAGE);
    }
  });

  for (const zone of state.blizzardZones) {
    zone.tickTimer += dt;
    if (zone.tickTimer < BLIZZARD_TICK_INTERVAL) continue;
    zone.tickTimer -= BLIZZARD_TICK_INTERVAL;
    const ctx = buildCtx('Blizzard');
    for (const enemy of state.enemies) {
      if (enemy.currentHp <= 0) continue;
      const macro = macroCellOfNode(enemy.pos);
      if (!isInBlizzardZone(state, macro.col, macro.row)) continue;
      applyWindDamage(ctx, enemy, BLIZZARD_TICK_DAMAGE);
    }
  }
}

export function addTornadoSegment(state: GameState, segment: Omit<TornadoSegment, 'tickTimer'>): void {
  ensureAirState(state);
  state.tornadoSegments.push({ ...segment, tickTimer: 0 });
}
