import { TURRET_MANA_RESERVATION } from '@/config/constants';
import type { GameState, Room } from '../types';
import type { RoomBehaviorDef } from './types';

export const TURRET_RANGE = 3;
export const TURRET_DAMAGE = 2;
export const TURRET_COOLDOWN = 2.0;

function isTurretRoom(room: Room): boolean {
  return room.blueprintId === 'turretRoom';
}

/** At wave start: reserve mana from maxMana per active turret; depower if insufficient. */
export function resetTurretRuntime(state: GameState): void {
  state.turretRuntime = {};
  const turrets = state.tower.rooms.filter(isTurretRoom);
  let remaining = state.player.maxMana;
  for (const turret of turrets) {
    if (remaining >= TURRET_MANA_RESERVATION) {
      state.turretRuntime[turret.id] = { depowered: false };
      remaining -= TURRET_MANA_RESERVATION;
    } else {
      state.turretRuntime[turret.id] = { depowered: true };
    }
  }
  state.player.maxMana = Math.max(0, remaining);
}

/** At wave end: restore maxMana for turrets that were active. */
export function restoreTurretMana(state: GameState): void {
  for (const turret of state.tower.rooms.filter(isTurretRoom)) {
    const runtime = state.turretRuntime[turret.id];
    if (runtime && !runtime.depowered) {
      state.player.maxMana += TURRET_MANA_RESERVATION;
    }
  }
  state.turretRuntime = {};
}

/** Auto-attacks the nearest enemy within range; mana reserved at wave start. */
export const turretRoom: RoomBehaviorDef = {
  blueprintId: 'turretRoom',
  mechanics: `${TURRET_DAMAGE} damage every ${TURRET_COOLDOWN}s · ${TURRET_RANGE} cell range · ${TURRET_MANA_RESERVATION} mana reserved/wave`,
  roles: ['turret'],
  attack: {
    cooldown: () => TURRET_COOLDOWN,
    run: (ctx) => {
      const runtime = ctx.state.turretRuntime[ctx.room.id];
      if (runtime?.depowered) return;
      const target = ctx.enemiesNear(TURRET_RANGE)[0];
      if (!target) return;
      ctx.attackEnemy(target, TURRET_DAMAGE, 0, 'Turret');
    },
  },
  reset: resetTurretRuntime,
};
