import { noteEnemyDamagedByRoom } from '../enemies/raid';
import { STEAM_TURRET_BLAST_DEPTH, STEAM_TURRET_CHARGE_SEC, STEAM_TURRET_DAMAGE } from '@/config/constants';
import { parseKey } from '@/calculations/grid';
import { computeDamage, type Combatant } from '@/calculations/combat';
import { addMessage } from '../messages';
import { getEnemyTemplate } from '../enemies';
import {
  adjacentSteamPipeKeys,
  isBoilerRoom,
  isSteamTurretRoom,
  steamComponentKeys,
} from '../pipes';
import type { Cell, Enemy, GameState, Room, Tower } from '../types';
import { boilerThroughput } from './boiler';
import { enemiesInBlastCells, exteriorSideBlastCells } from './sideBlast';
import type { RoomBehaviorDef } from './types';

/** Exterior blast cells for open left/right faces (depth × 3-wide). */
export function steamTurretBlastCells(tower: Tower, origin: Cell): Cell[] {
  return exteriorSideBlastCells(tower, origin, STEAM_TURRET_BLAST_DEPTH);
}

function attackEnemy(state: GameState, enemy: Enemy, roomId: string): void {
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
  noteEnemyDamagedByRoom(enemy, roomId);
    addMessage(state, `Steam Turret hits ${enemy.name} the ${template.type} for ${result.damage}.`, 'combat');
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
  return state.boilerRuntime[boiler.id]?.steamAvailable === true
    && adjacentSteamPipeKeys(state.tower, boiler.origin, boiler.size).some((key) => component.has(key));
}

function turretTouchesComponent(tower: Tower, turret: Room, component: Set<string>): boolean {
  return adjacentSteamPipeKeys(tower, turret.origin, turret.size).some((key) => component.has(key));
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
    const groupTurrets = turrets.filter((candidate) => turretTouchesComponent(state.tower, candidate, component));
    for (const candidate of groupTurrets) assigned.add(candidate.id);

    let capacity = 0;
    for (const boiler of boilers) {
      if (boilerTouchesComponent(state, boiler, component)) capacity += boilerThroughput(boiler);
    }
    const chargeRate = groupTurrets.length > 0 ? capacity / groupTurrets.length : 0;
    for (const candidate of groupTurrets) rates.set(candidate.id, chargeRate);
  }

  for (const turret of turrets) {
    const previous = state.steamTurretRuntime[turret.id] ?? { charge: 0, chargeRate: 0 };
    const chargeRate = rates.get(turret.id) ?? 0;
    let charge = Math.min(1, previous.charge + (dt / STEAM_TURRET_CHARGE_SEC) * chargeRate);
    if (charge >= 1) {
      const hits = enemiesInBlastCells(state, steamTurretBlastCells(state.tower, turret.origin));
      if (hits.length > 0) {
        for (const enemy of hits) attackEnemy(state, enemy, turret.id);
        charge = 0;
      }
    }
    state.steamTurretRuntime[turret.id] = { charge, chargeRate };
  }
}

export const steamTurretRoom: RoomBehaviorDef = {
  blueprintId: 'steamTurretRoom',
  mechanics: 'Charges from connected boiler steam, then blasts enemies on exposed sides.',
  roles: ['steamTurret'],
  tick: tickSteamTurrets,
  reset: resetSteamTurretRuntime,
};
