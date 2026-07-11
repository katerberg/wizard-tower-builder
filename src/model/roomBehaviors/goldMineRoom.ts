import type { RoomBehaviorDef } from './types';

export const GOLD_MINE_INCOME = 4;

/** Pays out gold each time a wave is cleared. */
export const goldMineRoomBehavior: RoomBehaviorDef = {
  blueprintId: 'goldMineRoom',
  mechanics: `+${GOLD_MINE_INCOME} gold when wave clears`,
  onWaveCleared: (ctx) => {
    ctx.reward(GOLD_MINE_INCOME);
    ctx.log(`Gold Mine yields ${GOLD_MINE_INCOME} gold.`, 'economy');
  },
};
