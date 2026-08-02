import { ENEMY_ATTACK_COOLDOWN } from '@/config/constants';
import { computeDamage, computeRoomStats, type Combatant } from '@/calculations/combat';
import { macroCol, macroRow } from '@/calculations/subGrid';
import { surfaceContacts } from '@/calculations/exteriorGraph';
import { getBlueprint } from '../blueprints';
import { addMessage } from '../messages';
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
import type { Enemy, EnemyTemplate, ExteriorNode, GameState } from '../types';

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
  applyDestructionAftermath(state, delta);
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

  const room = roomAt(state.tower, ceiling.col, ceiling.row);
  const structure = structureAt(state.tower, ceiling.col, ceiling.row);
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
      addMessage(state, `${bp?.name ?? 'Room'} collapses under demolisher assault!`, 'combat');
      // Framing may still block — no cascade from room-only remove, but pipes/staff update.
      applyDelta(state, delta);
    }
    return true;
  }

  if (structure) {
    const live = (state.tower.structures ?? []).find((s) => s.id === structure.id);
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
      addMessage(state, `${bp?.name ?? 'Structure'} collapses under demolisher assault!`, 'combat');
      const cascaded = cascadeUnsupportedStructures(state.tower);
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
