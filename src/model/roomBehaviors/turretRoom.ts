import type { RoomBehaviorDef } from './types';

/** Auto-attacks the nearest enemy within range. */
export const turretRoomBehavior: RoomBehaviorDef = {
  blueprintId: 'turretRoom',
  attack: {
    cooldown: () => 0.9,
    run: (ctx) => {
      const range = 3;
      const attack = 5;
      const target = ctx.enemiesNear(range)[0];
      if (target) {
        ctx.attackEnemy(target, attack, 0, 'Turret');
      }
    },
  },
};
