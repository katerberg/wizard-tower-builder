import type { RoomBehaviorDef } from './types';

export const TURRET_RANGE = 3;
export const TURRET_DAMAGE = 5;
export const TURRET_COOLDOWN = 0.9;

/** Auto-attacks the nearest enemy within range. */
export const turretRoomBehavior: RoomBehaviorDef = {
  blueprintId: 'turretRoom',
  mechanics: `${TURRET_DAMAGE} damage every ${TURRET_COOLDOWN}s · ${TURRET_RANGE} cell range`,
  attack: {
    cooldown: () => TURRET_COOLDOWN,
    run: (ctx) => {
      const target = ctx.enemiesNear(TURRET_RANGE)[0];
      if (target) {
        ctx.attackEnemy(target, TURRET_DAMAGE, 0, 'Turret');
      }
    },
  },
};
