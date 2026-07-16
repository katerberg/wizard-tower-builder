import { roomCells } from '@/calculations/grid';
import { macroCellOfNode } from '@/calculations/subGrid';
import { addMessage } from '@/model/messages';
import { computeRoomStats } from '@/calculations/combat';
import { getBlueprint } from '@/model/blueprints';
import { removeRoom, roomAt } from '@/model/tower';
import type { Cell, GameState, Room, Tower } from '@/model/types';
import type { SpellCastContext } from '../types';
import {
  QUAKE_ENEMY_DAMAGE_PER_CHARGE,
  QUAKE_ROOM_HP_FRACTION,
  QUAKE_TIP_DAMAGE_MULT,
} from './constants';
import { ensureEarthState, spendAllCharge } from './charge';

function roomsAdjacent(a: Room, b: Room): boolean {
  const cellsA = roomCells(a.origin, a.size);
  const cellsB = roomCells(b.origin, b.size);
  for (const ca of cellsA) {
    for (const cb of cellsB) {
      if (Math.abs(ca.col - cb.col) + Math.abs(ca.row - cb.row) === 1) return true;
    }
  }
  return false;
}

function roomTouchesGround(room: Room): boolean {
  return room.origin.row === 0 || roomCells(room.origin, room.size).some((c) => c.row === 0);
}

function roomMaxRow(room: Room): number {
  return room.origin.row + room.size.h - 1;
}

/**
 * Support spine from tip down to ground: BFS among room-adjacency,
 * preferring downward neighbors, until a ground-touching room is reached.
 */
export function supportSpineToGround(tower: Tower, tipRoomId: string): Room[] {
  const tip = tower.rooms.find((r) => r.id === tipRoomId);
  if (!tip) return [];

  const adj = new Map<string, Room[]>();
  for (const room of tower.rooms) adj.set(room.id, []);
  for (let i = 0; i < tower.rooms.length; i++) {
    for (let j = i + 1; j < tower.rooms.length; j++) {
      const a = tower.rooms[i];
      const b = tower.rooms[j];
      if (roomsAdjacent(a, b)) {
        adj.get(a.id)!.push(b);
        adj.get(b.id)!.push(a);
      }
    }
  }

  // BFS with parent pointers; explore lower rooms first
  const queue: string[] = [tip.id];
  const parent = new Map<string, string | null>([[tip.id, null]]);
  let groundId: string | null = null;

  while (queue.length > 0) {
    const id = queue.shift()!;
    const room = tower.rooms.find((r) => r.id === id)!;
    if (roomTouchesGround(room)) {
      groundId = id;
      break;
    }
    const neighbors = [...(adj.get(id) ?? [])].sort(
      (a, b) => roomMaxRow(a) - roomMaxRow(b) || a.origin.col - b.origin.col,
    );
    for (const n of neighbors) {
      if (parent.has(n.id)) continue;
      parent.set(n.id, id);
      queue.push(n.id);
    }
  }

  if (!groundId) {
    // No path to ground — return tip only
    return [tip];
  }

  const path: Room[] = [];
  let cur: string | null = groundId;
  while (cur) {
    const room = tower.rooms.find((r) => r.id === cur)!;
    path.push(room);
    cur = parent.get(cur) ?? null;
  }
  path.reverse(); // tip → … → ground? wait we walked ground→tip via parent from tip
  // parent links tip→…→ground when reconstructing from groundId upward to tip
  // path currently ground...tip if we pushed while walking parent from ground
  // We pushed ground first then parents toward tip, then reversed → tip…ground. Good.
  return path;
}

function enemyNearRooms(state: GameState, rooms: Room[]): { enemyId: string; nearTip: boolean }[] {
  const tip = rooms[0];
  const tipCells = new Set(roomCells(tip.origin, tip.size).map((c) => `${c.col},${c.row}`));
  const allCells = new Set<string>();
  for (const room of rooms) {
    for (const c of roomCells(room.origin, room.size)) {
      allCells.add(`${c.col},${c.row}`);
      // ortho adjacent exterior-ish: include adjacent empty cells as "along path"
      for (const [dc, dr] of [
        [0, 1],
        [0, -1],
        [1, 0],
        [-1, 0],
      ] as const) {
        allCells.add(`${c.col + dc},${c.row + dr}`);
      }
    }
  }

  const out: { enemyId: string; nearTip: boolean }[] = [];
  for (const enemy of state.enemies) {
    if (enemy.currentHp <= 0) continue;
    if (enemy.airborne) continue;
    const m = macroCellOfNode(enemy.pos);
    const key = `${m.col},${m.row}`;
    if (!allCells.has(key)) continue;
    const nearTip =
      tipCells.has(key) ||
      Math.abs(m.col - tip.origin.col) + Math.abs(m.row - tip.origin.row) <= 2;
    out.push({ enemyId: enemy.id, nearTip });
  }
  return out;
}

export function castEarthquake(state: GameState, tipRoomId: string, ctx: SpellCastContext): void {
  ensureEarthState(state);
  const spent = spendAllCharge(state);
  if (spent <= 0) return;

  const spine = supportSpineToGround(state.tower, tipRoomId);
  if (spine.length === 0) {
    addMessage(state, 'Earthquake finds no structure to crack.', 'info');
    return;
  }

  addMessage(
    state,
    `Earthquake cascades through ${spine.length} room(s) (${spent} Charge)!`,
    'combat',
  );

  // Enemies along path
  for (const { enemyId, nearTip } of enemyNearRooms(state, spine)) {
    const enemy = state.enemies.find((e) => e.id === enemyId);
    if (!enemy) continue;
    let damage = spent * QUAKE_ENEMY_DAMAGE_PER_CHARGE;
    if (nearTip) damage = Math.floor(damage * QUAKE_TIP_DAMAGE_MULT);
    ctx.damageEnemy(enemy, Math.max(1, damage));
  }

  // Room HP damage (~1/3 maxHp), may destroy
  const destroyed: string[] = [];
  for (const room of spine) {
    const live = state.tower.rooms.find((r) => r.id === room.id);
    if (!live) continue;
    const blueprint = getBlueprint(live.blueprintId);
    if (!blueprint) continue;
    const stats = computeRoomStats(live, blueprint);
    const dmg = Math.max(1, Math.ceil(stats.maxHp * QUAKE_ROOM_HP_FRACTION));
    live.hp = Math.max(0, live.hp - dmg);
    addMessage(state, `${blueprint.name} takes ${dmg} structural damage (${live.hp}/${stats.maxHp}).`, 'combat');
    if (live.hp <= 0) destroyed.push(live.id);
  }

  for (const id of destroyed) {
    const room = state.tower.rooms.find((r) => r.id === id);
    const name = room ? getBlueprint(room.blueprintId)?.name ?? 'Room' : 'Room';
    state.tower = removeRoom(state.tower, id);
    addMessage(state, `${name} collapses under the quake!`, 'combat');
    // Clear paths so climbers repath
    for (const enemy of state.enemies) {
      enemy.path = [];
      enemy.pathIndex = 0;
    }
  }
}

export function roomIdAtCell(tower: Tower, cell: Cell): string | null {
  const room = roomAt(tower, cell.col, cell.row);
  return room?.id ?? null;
}
