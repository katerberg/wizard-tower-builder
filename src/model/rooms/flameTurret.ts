import { MAGIC_TURRET_MANA_COST } from '@/config/constants';
import { flameTurretHasForge } from '../pipes';
import { KINDLED_DURATION } from '../spells/fire/constants';
import { applyKindled } from '../spells/fire/kindled';
import type { RoomBehaviorDef } from './types';

export const FLAME_TURRET_RANGE = 3;
export const FLAME_TURRET_DAMAGE = 2;
export const FLAME_TURRET_COOLDOWN = 0.9;

/** Deals low fire damage and Kindles enemies for a later fire-spell burst. */
export const flameTurretRoom: RoomBehaviorDef = {
  blueprintId: 'flameTurretRoom',
  mechanics: `${FLAME_TURRET_DAMAGE} damage + Kindled (${KINDLED_DURATION}s) every ${FLAME_TURRET_COOLDOWN}s · ${FLAME_TURRET_RANGE} cell range · ${MAGIC_TURRET_MANA_COST} mana/shot`,
  attack: {
    cooldown: () => FLAME_TURRET_COOLDOWN,
    run: (ctx) => {
      const target = ctx.enemiesNear(FLAME_TURRET_RANGE)[0];
      if (
        !target ||
        !flameTurretHasForge(ctx.state.tower, ctx.room, ctx.state.phase) ||
        ctx.state.player.mana < MAGIC_TURRET_MANA_COST
      ) {
        return;
      }

      ctx.state.player.mana -= MAGIC_TURRET_MANA_COST;
      const hpBefore = target.currentHp;
      ctx.attackEnemy(target, FLAME_TURRET_DAMAGE, 0, 'Flame Turret');
      if (target.currentHp < hpBefore) applyKindled(ctx.state, target);
    },
  },
};
