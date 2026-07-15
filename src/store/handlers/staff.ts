import {
  LABORER_RECRUIT_COST,
  MAGE_RECRUIT_COST,
  MANA_SPRING_STAFF_CAPACITY,
  SOLDIER_RECRUIT_COST,
} from '@/config/constants';
import { canAffordBuild } from '@/calculations/buildCost';
import { addMessage } from '@/model/messages';
import { isManaSpringRoom } from '@/model/pipes';
import { getBlueprint } from '@/model/blueprints';
import {
  HOUSING_MIN_RECRUITED,
  canRecruitInHousing,
  housingCapacity,
  housingKindOf,
  isHousingRoom,
  isSlotRoom,
  slotCapacity,
  staffKindForHousing,
} from '@/model/staff/capacity';
import type { StaffKind } from '@/model/types';
import type { HandlerContext } from '../context';
import type { Intent } from '../intents';

function recruitCost(kind: StaffKind): number {
  switch (kind) {
    case 'soldier':
      return SOLDIER_RECRUIT_COST;
    case 'mage':
      return MAGE_RECRUIT_COST;
    case 'laborer':
      return LABORER_RECRUIT_COST;
  }
}

function staffLabel(kind: StaffKind): string {
  switch (kind) {
    case 'soldier':
      return 'soldier';
    case 'mage':
      return 'mage';
    case 'laborer':
      return 'laborer';
  }
}

export function handleStaffIntent(ctx: HandlerContext, intent: Intent): void {
  switch (intent.type) {
    case 'recruitStaff':
      recruitStaff(ctx, intent.housingRoomId);
      break;
    case 'unrecruitStaff':
      unrecruitStaff(ctx, intent.housingRoomId);
      break;
    case 'setSlotAllocation':
      setSlotAllocation(ctx, intent.slotRoomId, intent.count);
      break;
    case 'setManaSpringAllocation':
      setManaSpringAllocation(ctx, intent.springRoomId, intent.count);
      break;
  }
}

function recruitStaff(ctx: HandlerContext, housingRoomId: string): void {
  const { game } = ctx;
  if (game.phase !== 'build' || !game.buildBaseline) return;

  const room = game.tower.rooms.find((r) => r.id === housingRoomId);
  if (!room || !isHousingRoom(room)) return;
  const housing = housingKindOf(room)!;
  const kind = staffKindForHousing(housing);

  const recruited = game.housingRecruited[housingRoomId] ?? 0;
  if (!canRecruitInHousing(room, recruited)) {
    const name = getBlueprint(room.blueprintId)?.name ?? 'Housing';
    addMessage(game, `${name} is at capacity.`, 'info');
    return;
  }

  const cost = recruitCost(kind);
  if (!canAffordBuild(game.buildBaseline, game.tower, cost, game.buildRecruitSpend)) {
    addMessage(game, `Not enough gold to recruit a ${staffLabel(kind)} (${cost}).`, 'economy');
    return;
  }

  ctx.recordBuildStep();
  game.buildRecruitSpend += cost;
  game.housingRecruited[housingRoomId] = recruited + 1;
  addMessage(
    game,
    `Recruited ${staffLabel(kind)} (${recruited + 1}/${housingCapacity(room)}).`,
    'info',
  );
}

function unrecruitStaff(ctx: HandlerContext, housingRoomId: string): void {
  const { game } = ctx;
  if (game.phase !== 'build' || !game.buildBaseline) return;

  const room = game.tower.rooms.find((r) => r.id === housingRoomId);
  if (!room || !isHousingRoom(room)) return;

  const recruited = game.housingRecruited[housingRoomId] ?? 0;
  if (recruited <= HOUSING_MIN_RECRUITED) {
    addMessage(game, 'Cannot unrecruit below the housing minimum.', 'info');
    return;
  }

  ctx.recordBuildStep();
  game.housingRecruited[housingRoomId] = recruited - 1;
  // No recruit-cost refund.
  addMessage(
    game,
    `Unrecruited (${recruited - 1}/${housingCapacity(room)}). Upkeep saved next wave.`,
    'info',
  );
}

function setSlotAllocation(ctx: HandlerContext, slotRoomId: string, count: number): void {
  const { game } = ctx;
  if (game.phase !== 'build') return;

  const room = game.tower.rooms.find((r) => r.id === slotRoomId);
  if (!room || !isSlotRoom(room)) return;

  const max = slotCapacity(room);
  const clamped = Math.max(0, Math.min(max, Math.floor(count)));
  if ((game.slotAllocations[slotRoomId] ?? 0) === clamped) return;
  ctx.recordBuildStep();
  game.slotAllocations[slotRoomId] = clamped;
}

function setManaSpringAllocation(ctx: HandlerContext, springRoomId: string, count: number): void {
  const { game } = ctx;
  if (game.phase !== 'build') return;

  const room = game.tower.rooms.find((r) => r.id === springRoomId);
  if (!room || !isManaSpringRoom(room)) return;

  const clamped = Math.max(0, Math.min(MANA_SPRING_STAFF_CAPACITY, Math.floor(count)));
  if ((game.manaSpringAllocations[springRoomId] ?? 0) === clamped) return;
  ctx.recordBuildStep();
  game.manaSpringAllocations[springRoomId] = clamped;
}
