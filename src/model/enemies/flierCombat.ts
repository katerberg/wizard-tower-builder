import { ENEMY_ATTACK_COOLDOWN, SUB_CELLS_PER_MACRO } from '@/config/constants';
import { roomCells } from '@/calculations/grid';
import { macroCellOfNode } from '@/calculations/subGrid';
import { computeDamage, type Combatant } from '@/calculations/combat';
import { getBlueprint } from '../blueprints';
import { addMessage } from '../messages';
import { removeRoom, roomAt } from '../tower';
import type { Enemy, EnemyTemplate, ExteriorNode, GameState, Room } from '../types';

function enemyCombatant(template: EnemyTemplate): Combatant {
  return { attack: template.stats.strength, defense: 0, dexterity: template.stats.dexterity };
}

/** Closest room by Manhattan distance from enemy macro position to footprint cells. */
export function closestRoomToEnemy(state: GameState, enemy: Enemy): Room | null {
  const em = macroCellOfNode(enemy.pos);
  let best: Room | null = null;
  let bestDist = Infinity;
  for (const room of state.tower.rooms) {
    for (const cell of roomCells(room.origin, room.size)) {
      const d = Math.abs(em.col - cell.col) + Math.abs(em.row - cell.row);
      if (d < bestDist) {
        bestDist = d;
        best = room;
      }
    }
  }
  return best;
}

/** Nearest approach sub-cell toward a room footprint that is still fly-walkable is handled by A*; here we just need adjacency for melee. */
export function enemyTouchesRoom(enemy: Enemy, room: Room): boolean {
  const em = macroCellOfNode(enemy.pos);
  for (const cell of roomCells(room.origin, room.size)) {
    if (Math.abs(em.col - cell.col) + Math.abs(em.row - cell.row) <= 1) return true;
  }
  return false;
}

export function attackWizard(
  state: GameState,
  enemy: Enemy,
  template: EnemyTemplate,
  wizard: { hp: number; attack: number; defense: number; dexterity: number },
  mitigate: (state: GameState, damage: number) => number,
  dt: number,
): void {
  enemy.attackCooldown -= dt;
  if (enemy.attackCooldown > 0) return;

  const defender: Combatant = {
    attack: wizard.attack,
    defense: wizard.defense,
    dexterity: wizard.dexterity,
  };
  const result = computeDamage(enemyCombatant(template), defender, state.rngState);
  state.rngState = result.rngState;
  if (result.dodged) {
    addMessage(state, `The wizard dodges ${enemy.name} the ${template.type}.`, 'combat');
  } else {
    const dealt = mitigate(state, result.damage);
    wizard.hp = Math.max(0, wizard.hp - dealt);
    addMessage(state, `${enemy.name} the ${template.type} hits the wizard for ${dealt}.`, 'combat');
  }
  enemy.attackCooldown = ENEMY_ATTACK_COOLDOWN;

  if (template.kamikaze) {
    enemy.currentHp = 0;
  }
}

/** Normal melee against the closest blocking room when air path is cut off. */
export function attackBlockingRoom(
  state: GameState,
  enemy: Enemy,
  template: EnemyTemplate,
  dt: number,
): void {
  const room = closestRoomToEnemy(state, enemy);
  if (!room) return;

  // Nudge path toward room: if not adjacent, leave empty so caller can path elsewhere;
  // when adjacent, swing.
  if (!enemyTouchesRoom(enemy, room)) return;

  enemy.attackCooldown -= dt;
  if (enemy.attackCooldown > 0) return;

  const live = state.tower.rooms.find((r) => r.id === room.id);
  if (!live) return;

  const result = computeDamage(
    enemyCombatant(template),
    { attack: 0, defense: 0, dexterity: 0 },
    state.rngState,
  );
  state.rngState = result.rngState;
  const dealt = Math.max(1, result.damage);
  live.hp = Math.max(0, live.hp - dealt);
  const bp = getBlueprint(live.blueprintId);
  addMessage(
    state,
    `${enemy.name} the ${template.type} hits ${bp?.name ?? 'Room'} for ${dealt} (${live.hp} hp).`,
    'combat',
  );
  enemy.attackCooldown = ENEMY_ATTACK_COOLDOWN;

  if (live.hp <= 0) {
    state.tower = removeRoom(state.tower, live.id);
    addMessage(state, `${bp?.name ?? 'Room'} collapses under air assault!`, 'combat');
    for (const e of state.enemies) {
      e.path = [];
      e.pathIndex = 0;
    }
  }

  if (template.kamikaze) {
    enemy.currentHp = 0;
  }
}

/** Path target for a blocked flier: center of closest room (goal may be solid — A* fails; we step greedily). */
export function greedyStepTowardRoom(
  enemy: Enemy,
  room: Room,
  isStepOk: (col: number, row: number) => boolean,
): ExteriorNode | null {
  const em = macroCellOfNode(enemy.pos);
  let target = room.origin;
  let best = Infinity;
  for (const cell of roomCells(room.origin, room.size)) {
    const d = Math.abs(em.col - cell.col) + Math.abs(em.row - cell.row);
    if (d < best) {
      best = d;
      target = cell;
    }
  }

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
      return { col: c.col, row: c.row, face: 'air' };
    }
  }
  return null;
}

export function roomStillExists(state: GameState, roomId: string): boolean {
  return state.tower.rooms.some((r) => r.id === roomId);
}

export function roomAtEnemy(state: GameState, enemy: Enemy): Room | undefined {
  const m = macroCellOfNode(enemy.pos);
  return roomAt(state.tower, m.col, m.row);
}
