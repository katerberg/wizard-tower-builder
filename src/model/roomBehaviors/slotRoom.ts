import {
  SLOT_ATTACK_COOLDOWN,
  SLOT_ATTACK_RANGE,
  SLOT_BASE_DAMAGE,
  SLOT_FIRE_EFFICIENCY,
} from '@/config/constants';
import { stationedSoldiersInSlot } from '@/model/soldiers';
import type { RoomBehaviorDef } from './types';

/** Fires a volley using stationed soldiers with crowding efficiency. */
export const slotRoomBehavior: RoomBehaviorDef = {
  blueprintId: 'slotRoom',
  attack: {
    cooldown: () => SLOT_ATTACK_COOLDOWN,
    run: (ctx) => {
      const stationed = stationedSoldiersInSlot(ctx.state, ctx.room.id);
      if (stationed.length === 0) return;

      let damage = 0;
      for (let i = 0; i < stationed.length; i++) {
        const efficiency = SLOT_FIRE_EFFICIENCY[i] ?? SLOT_FIRE_EFFICIENCY[SLOT_FIRE_EFFICIENCY.length - 1];
        damage += SLOT_BASE_DAMAGE * efficiency;
      }
      if (damage <= 0) return;

      const target = ctx.enemiesNear(SLOT_ATTACK_RANGE)[0];
      if (target) {
        ctx.attackEnemy(target, Math.round(damage), 0, 'Slot');
      }
    },
  },
};
