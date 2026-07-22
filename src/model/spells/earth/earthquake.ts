import { roomCells } from '@/calculations/grid';
import { macroCellOfNode } from '@/calculations/subGrid';
import { addMessage } from '@/model/messages';
import { computeStructureStats } from '@/calculations/combat';
import { getBlueprint } from '@/model/blueprints';
import { removeStructure, structureAt } from '@/model/tower';
import type { Cell, GameState, Structure, Tower } from '@/model/types';
import type { SpellCastContext } from '../types';
import {
  QUAKE_ENEMY_DAMAGE_PER_CHARGE,
  QUAKE_ROOM_HP_FRACTION,
  QUAKE_TIP_DAMAGE_MULT,
} from './constants';
import { ensureEarthState, spendAllCharge } from './charge';

function structuresAdjacent(a: Structure, b: Structure): boolean {
  const cellsA = roomCells(a.origin, a.size);
  const cellsB = roomCells(b.origin, b.size);
  for (const ca of cellsA) {
    for (const cb of cellsB) {
      if (Math.abs(ca.col - cb.col) + Math.abs(ca.row - cb.row) === 1) return true;
    }
  }
  return false;
}

function structureTouchesGround(piece: Structure): boolean {
  return piece.origin.row === 0 || roomCells(piece.origin, piece.size).some((c) => c.row === 0);
}

function structureMaxRow(piece: Structure): number {
  return piece.origin.row + piece.size.h - 1;
}

/**
 * Support spine from tip down to ground: BFS among structure-adjacency,
 * preferring downward neighbors, until a ground-touching piece is reached.
 */
export function supportSpineToGround(tower: Tower, tipStructureId: string): Structure[] {
  const structures = tower.structures ?? [];
  const tip = structures.find((s) => s.id === tipStructureId);
  if (!tip) return [];

  const adj = new Map<string, Structure[]>();
  for (const piece of structures) adj.set(piece.id, []);
  for (let i = 0; i < structures.length; i++) {
    for (let j = i + 1; j < structures.length; j++) {
      const a = structures[i];
      const b = structures[j];
      if (structuresAdjacent(a, b)) {
        adj.get(a.id)!.push(b);
        adj.get(b.id)!.push(a);
      }
    }
  }

  const queue: string[] = [tip.id];
  const parent = new Map<string, string | null>([[tip.id, null]]);
  let groundId: string | null = null;

  while (queue.length > 0) {
    const id = queue.shift()!;
    const piece = structures.find((s) => s.id === id)!;
    if (structureTouchesGround(piece)) {
      groundId = id;
      break;
    }
    const neighbors = [...(adj.get(id) ?? [])].sort(
      (a, b) => structureMaxRow(a) - structureMaxRow(b) || a.origin.col - b.origin.col,
    );
    for (const n of neighbors) {
      if (parent.has(n.id)) continue;
      parent.set(n.id, id);
      queue.push(n.id);
    }
  }

  if (!groundId) {
    return [tip];
  }

  const path: Structure[] = [];
  let cur: string | null = groundId;
  while (cur) {
    const piece = structures.find((s) => s.id === cur)!;
    path.push(piece);
    cur = parent.get(cur) ?? null;
  }
  path.reverse();
  return path;
}

function enemyNearStructures(
  state: GameState,
  pieces: Structure[],
): { enemyId: string; nearTip: boolean }[] {
  const tip = pieces[0];
  const tipCells = new Set(roomCells(tip.origin, tip.size).map((c) => `${c.col},${c.row}`));
  const allCells = new Set<string>();
  for (const piece of pieces) {
    for (const c of roomCells(piece.origin, piece.size)) {
      allCells.add(`${c.col},${c.row}`);
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

export function castEarthquake(state: GameState, tipStructureId: string, ctx: SpellCastContext): void {
  ensureEarthState(state);
  const spent = spendAllCharge(state);
  if (spent <= 0) return;

  const spine = supportSpineToGround(state.tower, tipStructureId);
  if (spine.length === 0) {
    addMessage(state, 'Earthquake finds no structure to crack.', 'info');
    return;
  }

  addMessage(
    state,
    `Earthquake cascades through ${spine.length} framing piece(s) (${spent} Charge)!`,
    'combat',
  );

  for (const { enemyId, nearTip } of enemyNearStructures(state, spine)) {
    const enemy = state.enemies.find((e) => e.id === enemyId);
    if (!enemy) continue;
    let damage = spent * QUAKE_ENEMY_DAMAGE_PER_CHARGE;
    if (nearTip) damage = Math.floor(damage * QUAKE_TIP_DAMAGE_MULT);
    ctx.damageEnemy(enemy, Math.max(1, damage));
  }

  const destroyed: string[] = [];
  for (const piece of spine) {
    const live = (state.tower.structures ?? []).find((s) => s.id === piece.id);
    if (!live) continue;
    const blueprint = getBlueprint(live.blueprintId);
    if (!blueprint) continue;
    const stats = computeStructureStats(live, blueprint);
    const dmg = Math.max(1, Math.ceil(stats.maxHp * QUAKE_ROOM_HP_FRACTION));
    live.hp = Math.max(0, live.hp - dmg);
    addMessage(state, `${blueprint.name} takes ${dmg} structural damage (${live.hp}/${stats.maxHp}).`, 'combat');
    if (live.hp <= 0) destroyed.push(live.id);
  }

  for (const id of destroyed) {
    const piece = (state.tower.structures ?? []).find((s) => s.id === id);
    const name = piece ? getBlueprint(piece.blueprintId)?.name ?? 'Structure' : 'Structure';
    state.tower = removeStructure(state.tower, id);
    addMessage(state, `${name} collapses under the quake!`, 'combat');
    for (const enemy of state.enemies) {
      enemy.path = [];
      enemy.pathIndex = 0;
    }
  }
}

/** Tip id for earthquake — prefer structure under the cell (framing is the quake target). */
export function roomIdAtCell(tower: Tower, cell: Cell): string | null {
  const structure = structureAt(tower, cell.col, cell.row);
  return structure?.id ?? null;
}
