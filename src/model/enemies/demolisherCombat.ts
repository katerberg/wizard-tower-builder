import { afterRoomRemovedCheckStorageLose } from './raid';
import { ENEMY_ATTACK_COOLDOWN, SUB_CELLS_PER_MACRO } from '@/config/constants';
import { computeDamage, computeRoomStats, type Combatant } from '@/calculations/combat';
import { roomCells } from '@/calculations/grid';
import { macroCol, macroRow, macroCellOfNode } from '@/calculations/subGrid';
import { surfaceContacts } from '@/calculations/exteriorGraph';
import { getBlueprint } from '../blueprints';
import { addMessage } from '../messages';
import { isOverhangUnlocked } from '../research';
import { runEnemyAttackRoomEffects } from '../modifications/effects';
import {
  applyDestructionAftermath,
  mergeRemovalDeltas,
  roomRemovalDelta,
} from '../staff/destruction';
import {
  cascadeUnsupportedStructures,
  removeRoom,
  removeStructureDetailed,
  roomAt,
  structureAt,
} from '../tower';
import type { RemovalDelta } from '../tower/sell';
import type { Cell, Enemy, EnemyTemplate, ExteriorNode, GameState, Structure } from '../types';

function enemyCombatant(template: EnemyTemplate): Combatant {
  return { attack: template.stats.strength, defense: 0, dexterity: template.stats.dexterity };
}

/** Macro cell of the framing/room forming the ceiling above a sub-cell path node. */
export function overhangCeilingMacro(
  tower: GameState['tower'],
  nextPos: ExteriorNode,
): { col: number; row: number } | null {
  const contacts = surfaceContacts(tower, nextPos.col, nextPos.row);
  if (!contacts.has('underCeiling')) return null;
  return { col: macroCol(nextPos.col), row: macroRow(nextPos.row + 1) };
}

function clearEnemyPaths(state: GameState): void {
  for (const e of state.enemies) {
    e.path = [];
    e.pathIndex = 0;
    e.pathGoalKey = undefined;
  }
}

function applyDelta(state: GameState, delta: RemovalDelta): void {
  if (
    delta.removedRoomIds.length === 0 &&
    delta.removedStructureIds.length === 0 &&
    delta.clearedCells.length === 0
  ) {
    clearEnemyPaths(state);
    return;
  }
  for (const roomId of delta.removedRoomIds) {
    const wasStorage = Boolean(state.storageSites[roomId]);
    if (wasStorage) {
      afterRoomRemovedCheckStorageLose(state, roomId, 'storageRoom');
    }
  }
  applyDestructionAftermath(state, delta);
}

export interface SmashTarget {
  col: number;
  row: number;
}

/** Ortho-adjacent (or same) macro to enemy position. */
export function enemyTouchesMacro(enemy: Enemy, col: number, row: number): boolean {
  const em = macroCellOfNode(enemy.pos);
  return Math.abs(em.col - col) + Math.abs(em.row - row) <= 1;
}

/**
 * Closest smashable room or framing cell by Manhattan distance from the enemy.
 * Prefer rooms when distances tie (smash order matches room-then-framing combat).
 */
export function closestSmashTarget(state: GameState, enemy: Enemy): SmashTarget | null {
  const em = macroCellOfNode(enemy.pos);
  let best: SmashTarget | null = null;
  let bestDist = Infinity;
  let bestIsRoom = false;

  for (const room of state.tower.rooms) {
    for (const cell of roomCells(room.origin, room.size)) {
      const d = Math.abs(em.col - cell.col) + Math.abs(em.row - cell.row);
      if (d < bestDist || (d === bestDist && !bestIsRoom)) {
        bestDist = d;
        best = { col: cell.col, row: cell.row };
        bestIsRoom = true;
      }
    }
  }

  for (const structure of state.tower.structures ?? []) {
    for (const cell of roomCells(structure.origin, structure.size)) {
      const d = Math.abs(em.col - cell.col) + Math.abs(em.row - cell.row);
      if (d < bestDist || (d === bestDist && !bestIsRoom)) {
        bestDist = d;
        best = { col: cell.col, row: cell.row };
        bestIsRoom = false;
      }
    }
  }

  return best;
}

/** Greedy exterior step toward a smash macro cell. */
export function greedyStepTowardSmashTarget(
  enemy: Enemy,
  target: SmashTarget,
  isStepOk: (col: number, row: number) => boolean,
): ExteriorNode | null {
  const mid = Math.floor(SUB_CELLS_PER_MACRO / 2);
  const goalCol = target.col * SUB_CELLS_PER_MACRO + mid;
  const goalRow = target.row * SUB_CELLS_PER_MACRO + mid;
  const dc = Math.sign(goalCol - enemy.pos.col);
  const dr = Math.sign(goalRow - enemy.pos.row);

  const candidates = [
    { col: enemy.pos.col + dc, row: enemy.pos.row },
    { col: enemy.pos.col, row: enemy.pos.row + dr },
    { col: enemy.pos.col + dc, row: enemy.pos.row + dr },
  ];
  for (const c of candidates) {
    if (c.col === enemy.pos.col && c.row === enemy.pos.row) continue;
    if (isStepOk(c.col, c.row)) {
      return { col: c.col, row: c.row, face: enemy.pos.face };
    }
  }
  return null;
}

/**
 * Melee room then framing at a macro cell.
 * Returns true when a swing was attempted (including on cooldown).
 */
export function attackSmashAtMacro(
  state: GameState,
  enemy: Enemy,
  template: EnemyTemplate,
  cell: Cell,
  dt: number,
  collapseVerb = 'assault',
): boolean {
  const room = roomAt(state.tower, cell.col, cell.row);
  const structure = structureAt(state.tower, cell.col, cell.row);
  if (!room && !structure) return false;

  enemy.attackCooldown -= dt;
  if (enemy.attackCooldown > 0) return true;

  if (room) {
    const live = state.tower.rooms.find((r) => r.id === room.id);
    if (!live) return true;
    const bp = getBlueprint(live.blueprintId);
    const stats = bp ? computeRoomStats(live, bp) : { maxHp: live.hp, attack: 0, defense: 0 };
    const result = computeDamage(
      enemyCombatant(template),
      { attack: 0, defense: stats.defense, dexterity: 0 },
      state.rngState,
    );
    state.rngState = result.rngState;
    const dealt = Math.max(1, result.damage);
    live.hp = Math.max(0, live.hp - dealt);
    addMessage(
      state,
      `${enemy.name} the ${template.type} smashes ${bp?.name ?? 'Room'} for ${dealt} (${live.hp} hp).`,
      'combat',
    );
    runEnemyAttackRoomEffects(state, enemy, live);
    enemy.attackCooldown = ENEMY_ATTACK_COOLDOWN;

    if (live.hp <= 0) {
      const delta = roomRemovalDelta(state, live.id);
      state.tower = removeRoom(state.tower, live.id);
      addMessage(state, `${bp?.name ?? 'Room'} collapses under ${collapseVerb}!`, 'combat');
      applyDelta(state, delta);
    }
    return true;
  }

  if (structure) {
    const live = (state.tower.structures ?? []).find((s: Structure) => s.id === structure.id);
    if (!live) return true;
    const bp = getBlueprint(live.blueprintId);
    const result = computeDamage(
      enemyCombatant(template),
      { attack: 0, defense: 0, dexterity: 0 },
      state.rngState,
    );
    state.rngState = result.rngState;
    const dealt = Math.max(1, result.damage);
    live.hp = Math.max(0, live.hp - dealt);
    addMessage(
      state,
      `${enemy.name} the ${template.type} smashes ${bp?.name ?? 'Structure'} for ${dealt} (${live.hp} hp).`,
      'combat',
    );
    enemy.attackCooldown = ENEMY_ATTACK_COOLDOWN;

    if (live.hp <= 0) {
      const removed = removeStructureDetailed(state.tower, live.id);
      state.tower = removed.tower;
      addMessage(state, `${bp?.name ?? 'Structure'} collapses under ${collapseVerb}!`, 'combat');
      const cascaded = cascadeUnsupportedStructures(state.tower, isOverhangUnlocked(state));
      state.tower = cascaded.tower;
      const delta = mergeRemovalDeltas(removed.delta, cascaded.delta);
      if (cascaded.delta.removedStructureIds.length > 0) {
        addMessage(state, 'Unsupported framing cascades down the tower!', 'combat');
      }
      applyDelta(state, delta);
    }
    return true;
  }

  return false;
}

/**
 * Melee the overhang blocking `nextPos` on the preferred path: room first, then framing.
 * Returns true when a swing was attempted (including on cooldown).
 */
export function attackOverhangBlocking(
  state: GameState,
  enemy: Enemy,
  template: EnemyTemplate,
  nextPos: ExteriorNode,
  dt: number,
): boolean {
  const ceiling = overhangCeilingMacro(state.tower, nextPos);
  if (!ceiling) return false;
  return attackSmashAtMacro(state, enemy, template, ceiling, dt, 'demolisher assault');
}

/**
 * When the wizard is unreachable: approach closest room/framing and smash it.
 * Returns true when the enemy spent this tick on stuck-smash behavior.
 */
export function handleStuckClimberSmash(
  state: GameState,
  enemy: Enemy,
  template: EnemyTemplate,
  dt: number,
  isStepOk: (col: number, row: number) => boolean,
  onMoved: (stepTo: ExteriorNode) => void,
  moveCooldownForStep: () => number,
): boolean {
  if (template.movement.canFly) return false;
  const target = closestSmashTarget(state, enemy);
  if (!target) return false;

  if (enemyTouchesMacro(enemy, target.col, target.row)) {
    attackSmashAtMacro(state, enemy, template, target, dt, 'climber assault');
    return true;
  }

  enemy.moveCooldown -= dt;
  if (enemy.moveCooldown <= 0) {
    const stepTo = greedyStepTowardSmashTarget(enemy, target, isStepOk);
    if (stepTo) {
      enemy.pos = stepTo;
      onMoved(stepTo);
    }
    enemy.moveCooldown = moveCooldownForStep();
  }
  return true;
}
