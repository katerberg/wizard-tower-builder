import type { RoomBehaviorDef } from './types';

/** Pays out gold each time a wave is cleared. */
export const goldMineRoomBehavior: RoomBehaviorDef = {
  blueprintId: 'goldMineRoom',
  onWaveCleared: (ctx) => {
    const income = 4;
    ctx.reward(income);
    ctx.log(`Gold Mine yields ${income} gold.`, 'economy');
  },
};
