import {
  FLAME_TURRET_BLAST_DEPTH,
  FLAME_TURRET_CHARGE_SEC,
  FLAME_TURRET_DAMAGE,
  MAGIC_TURRET_MANA_COST,
} from '@/config/constants';
import { computeDamage, type Combatant } from '@/calculations/combat';
import { addMessage } from '../messages';
import { getEnemyTemplate } from '../enemies';
import { flameTurretHasForge, isFlameTurretRoom } from '../pipes';
import { KINDLED_DURATION } from '../spells/fire/constants';
import { applyKindled } from '../spells/fire/kindled';
import type { Cell, Enemy, GameState, Tower } from '../types';
import { enemiesInBlastCells, exteriorSideBlastCells } from './sideBlast';
import type { RoomBehaviorDef } from './types';

/** Exterior blast cells for open left/right faces (depth × 3-wide). */
export function flameTurretBlastCells(tower: Tower, origin: Cell): Cell[] {
  return exteriorSideBlastCells(tower, origin, FLAME_TURRET_BLAST_DEPTH);
}

function attackEnemy(state: GameState, enemy: Enemy): void {
  const template = getEnemyTemplate(enemy.templateId);
  if (!template) return;
  const attacker: Combatant = { attack: FLAME_TURRET_DAMAGE, defense: 0, dexterity: 0 };
  const defender: Combatant = { attack: 0, defense: 0, dexterity: template.stats.dexterity };
  const result = computeDamage(attacker, defender, state.rngState);
  state.rngState = result.rngState;
  if (result.dodged) {
    addMessage(state, `${enemy.name} the ${template.type} dodges the Flame Turret.`, 'combat');
    return;
  }
  const hpBefore = enemy.currentHp;
  enemy.currentHp -= result.damage;
  addMessage(state, `Flame Turret hits ${enemy.name} the ${template.type} for ${result.damage}.`, 'combat');
  if (enemy.currentHp < hpBefore) applyKindled(state, enemy);
}

export function resetFlameTurretRuntime(state: GameState): void {
  state.flameTurretRuntime = {};
  for (const room of state.tower.rooms) {
    if (!isFlameTurretRoom(room)) continue;
    state.flameTurretRuntime[room.id] = { charge: 0, chargeRate: 0 };
  }
}

/** Charge while forge-connected, then full-dump side blast (mana per dump). */
export function tickFlameTurrets(state: GameState, dt: number): void {
  const phase = state.phase === 'attack' ? 'attack' : 'build';
  for (const turret of state.tower.rooms.filter(isFlameTurretRoom)) {
    const previous = state.flameTurretRuntime[turret.id] ?? { charge: 0, chargeRate: 0 };
    const chargeRate = flameTurretHasForge(state.tower, turret, phase) ? 1 : 0;
    let charge = Math.min(1, previous.charge + (dt / FLAME_TURRET_CHARGE_SEC) * chargeRate);
    if (charge >= 1) {
      const hits = enemiesInBlastCells(state, flameTurretBlastCells(state.tower, turret.origin));
      if (hits.length > 0 && state.player.mana >= MAGIC_TURRET_MANA_COST) {
        state.player.mana -= MAGIC_TURRET_MANA_COST;
        for (const enemy of hits) attackEnemy(state, enemy);
        charge = 0;
      }
    }
    state.flameTurretRuntime[turret.id] = { charge, chargeRate };
  }
}

export const flameTurretRoom: RoomBehaviorDef = {
  blueprintId: 'flameTurretRoom',
  mechanics: `Charges ${FLAME_TURRET_CHARGE_SEC}s from a fire-connected Forge, then blasts open sides for ${FLAME_TURRET_DAMAGE} + Kindled (${KINDLED_DURATION}s) · ${MAGIC_TURRET_MANA_COST} mana/blast`,
  roles: ['turret'],
  tick: tickFlameTurrets,
  reset: resetFlameTurretRuntime,
};
