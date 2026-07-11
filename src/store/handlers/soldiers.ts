import { SOLDIER_RECRUIT_COST } from '@/config/constants';
import { canAffordBuild } from '@/calculations/buildCost';
import { addMessage } from '@/model/messages';
import { barracksCapacity, canRecruitInBarracks, isBarracksRoom, isSlotRoom, slotCapacity } from '@/model/soldiers/capacity';
import type { HandlerContext } from '../context';
import type { Intent } from '../intents';

export function handleSoldiersIntent(ctx: HandlerContext, intent: Intent): void {
  switch (intent.type) {
    case 'recruitSoldier':
      recruitSoldier(ctx, intent.barracksRoomId);
      break;
    case 'setSlotAllocation':
      setSlotAllocation(ctx, intent.slotRoomId, intent.count);
      break;
  }
}

function recruitSoldier(ctx: HandlerContext, barracksRoomId: string): void {
  const { game } = ctx;
  if (game.phase !== 'build' || !game.buildBaseline) return;

  const room = game.tower.rooms.find((r) => r.id === barracksRoomId);
  if (!room || !isBarracksRoom(room)) return;

  const recruited = game.barracksRecruited[barracksRoomId] ?? 0;
  if (!canRecruitInBarracks(room, recruited)) {
    addMessage(game, 'Barracks is at capacity.', 'info');
    return;
  }

  if (!canAffordBuild(game.buildBaseline, game.tower, SOLDIER_RECRUIT_COST, game.buildRecruitSpend)) {
    addMessage(game, `Not enough gold to recruit a soldier (${SOLDIER_RECRUIT_COST}).`, 'economy');
    return;
  }

  game.buildRecruitSpend += SOLDIER_RECRUIT_COST;
  game.barracksRecruited[barracksRoomId] = recruited + 1;
  addMessage(game, `Recruited soldier (${recruited + 1}/${barracksCapacity(room)}).`, 'info');
}

function setSlotAllocation(ctx: HandlerContext, slotRoomId: string, count: number): void {
  const { game } = ctx;
  if (game.phase !== 'build') return;

  const room = game.tower.rooms.find((r) => r.id === slotRoomId);
  if (!room || !isSlotRoom(room)) return;

  const max = slotCapacity(room);
  const clamped = Math.max(0, Math.min(max, Math.floor(count)));
  game.slotAllocations[slotRoomId] = clamped;
}
