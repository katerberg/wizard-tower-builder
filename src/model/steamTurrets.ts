import { STEAM_TURRET_BLAST_DEPTH, STEAM_TURRET_CHARGE_SEC, STEAM_TURRET_DAMAGE } from '@/config/constants';
import { cellKey, parseKey } from '@/calculations/grid';
import { computeDamage, type Combatant } from '@/calculations/combat';
import { macroCellOfNode } from '@/calculations/subGrid';
import { boilerThroughput } from './boilers';
import { addMessage } from './messages';
import { getEnemyTemplate } from './enemies';
import {
  adjacentSteamPipeKeys,
  isBoilerRoom,
  isSteamTurretRoom,
  steamComponentKeys,
} from './pipes';
import type { Cell, Enemy, GameState, Room, Tower } from './types';

function isOccupied(tower: Tower, col: number, row: number): boolean {
  return Object.prototype.hasOwnProperty.call(tower.occupancy, cellKey(col, row));
}

/** Exterior blast cells for open left/right faces (depth × 3-wide). */
export function steamTurretBlastCells(tower: Tower, origin: Cell): Cell[] {
  const cells: Cell[] = [];
  const { col: c, row: r } = origin;
  const depth = STEAM_TURRET_BLAST_DEPTH;
  const offsets = [-1, 0, 1] as const;

  if (!isOccupied(tower, c - 1, r)) {
    for (let d = 1; d <= depth; d++) {
      for (const o of offsets) {
        cells.push({ col: c - d, row: r + o });
      }
    }
  }
  if (!isOccupied(tower, c + 1, r)) {
    for (let d = 1; d <= depth; d++) {
      for (const o of offsets) {
        cells.push({ col: c + d, row: r + o });
      }
    }
  }
  return cells;
}

function enemiesInBlast(state: GameState, blast: Cell[]): Enemy[] {
  const keys = new Set(blast.map((c) => cellKey(c.col, c.row)));
  return state.enemies.filter((e) => {
    if (e.currentHp <= 0) return false;
    const m = macroCellOfNode(e.pos);
    return keys.has(cellKey(m.col, m.row));
  });
}

function attackEnemy(state: GameState, enemy: Enemy): void {
  const template = getEnemyTemplate(enemy.templateId);
  if (!template) return;
  const attacker: Combatant = { attack: STEAM_TURRET_DAMAGE, defense: 0, dexterity: 0 };
  const defender: Combatant = { attack: 0, defense: 0, dexterity: template.stats.dexterity };
  const result = computeDamage(attacker, defender, state.rngState);
  state.rngState = result.rngState;
  if (result.dodged) {
    addMessage(state, `${enemy.name} the ${template.type} dodges the Steam Turret.`, 'combat');
  } else {
    enemy.currentHp -= result.damage;
    addMessage(
      state,
      `Steam Turret hits ${enemy.name} the ${template.type} for ${result.damage}.`,
      'combat',
    );
  }
}

export function resetSteamTurretRuntime(state: GameState): void {
  state.steamTurretRuntime = {};
  for (const room of state.tower.rooms) {
    if (!isSteamTurretRoom(room)) continue;
    state.steamTurretRuntime[room.id] = { charge: 0, chargeRate: 0 };
  }
}

function boilerTouchesComponent(state: GameState, boiler: Room, component: Set<string>): boolean {
  if (!state.boilerRuntime[boiler.id]?.steamAvailable) return false;
  return adjacentSteamPipeKeys(state.tower, boiler.origin, boiler.size).some((k) =>
    component.has(k),
  );
}

function turretTouchesComponent(tower: Tower, turret: Room, component: Set<string>): boolean {
  return adjacentSteamPipeKeys(tower, turret.origin, turret.size).some((k) => component.has(k));
}

/** Charge from shared boiler throughput, then full-dump blast when ready. */
export function tickSteamTurrets(state: GameState, dt: number): void {
  const turrets = state.tower.rooms.filter(isSteamTurretRoom);
  const boilers = state.tower.rooms.filter(isBoilerRoom);

  const assigned = new Set<string>();
  const rates = new Map<string, number>();

  for (const turret of turrets) {
    if (assigned.has(turret.id)) continue;
    const pipeKeys = adjacentSteamPipeKeys(state.tower, turret.origin, turret.size);
    if (pipeKeys.length === 0) {
      rates.set(turret.id, 0);
      assigned.add(turret.id);
      continue;
    }

    const component = steamComponentKeys(state.tower, parseKey(pipeKeys[0]));

    const groupTurrets = turrets.filter((t) => turretTouchesComponent(state.tower, t, component));
    for (const t of groupTurrets) assigned.add(t.id);

    let capacity = 0;
    for (const boiler of boilers) {
      if (boilerTouchesComponent(state, boiler, component)) {
        capacity += boilerThroughput(boiler);
      }
    }

    const chargeRate = groupTurrets.length > 0 ? capacity / groupTurrets.length : 0;
    for (const t of groupTurrets) {
      rates.set(t.id, chargeRate);
    }
  }

  for (const turret of turrets) {
    const prev = state.steamTurretRuntime[turret.id] ?? { charge: 0, chargeRate: 0 };
    const chargeRate = rates.get(turret.id) ?? 0;
    let charge = Math.min(1, prev.charge + (dt / STEAM_TURRET_CHARGE_SEC) * chargeRate);

    if (charge >= 1) {
      const blast = steamTurretBlastCells(state.tower, turret.origin);
      const hits = enemiesInBlast(state, blast);
      if (hits.length > 0) {
        for (const enemy of hits) {
          attackEnemy(state, enemy);
        }
        charge = 0;
      }
    }

    state.steamTurretRuntime[turret.id] = { charge, chargeRate };
  }
}
