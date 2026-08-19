import {
  LABORER_RECRUIT_COST,
  MAGE_RECRUIT_COST,
  MANA_SPRING_STAFF_CAPACITY,
  PROSPECT_MAX_ALLOCATION,
  RESEARCH_ROOM_STAFF_CAPACITY,
  SOLDIER_RECRUIT_COST,
} from '@/config/constants';
import { RECRUIT_SIDE_JOB_SEC } from '@/config/dayNight';
import { addMessage } from '@/model/messages';
import { isManaSpringRoom } from '@/model/pipes';
import { isResearchRoom } from '@/model/research';
import { getBlueprint } from '@/model/blueprints';
import { enqueueSideJob } from '@/model/sideJobs';
import {
  HOUSING_MIN_RECRUITED,
  canRecruitInHousing,
  housingKindOf,
  isHousingRoom,
  isSlotRoom,
  slotCapacity,
  staffKindForHousing,
} from '@/model/staff/capacity';
import type { GameState, StaffKind } from '@/model/types';
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
    case 'setResearchAllocation':
      setResearchAllocation(ctx, intent.researchRoomId, intent.count);
      break;
    case 'setProspectAllocation':
      setProspectAllocation(ctx, intent.count);
      break;
  }
}

function recruitStaff(ctx: HandlerContext, housingRoomId: string): void {
  const { game } = ctx;
  if (game.phase !== 'day') return;

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
  if (game.player.resources.gold - game.pendingRecruitSpend < cost) {
    addMessage(game, `Not enough gold to recruit a ${staffLabel(kind)} (${cost}).`, 'economy');
    return;
  }

  enqueueSideJob(game, 'recruit', `Recruiting ${staffLabel(kind)}`, RECRUIT_SIDE_JOB_SEC, {
    housingRoomId,
    kind,
    cost,
    onComplete: (state: GameState, payload: Record<string, unknown>) => {
      const id = payload.housingRoomId as string;
      const c = payload.cost as number;
      state.pendingRecruitSpend += c;
      state.housingRecruited[id] = (state.housingRecruited[id] ?? 0) + 1;
      addMessage(state, `Recruited ${staffLabel(payload.kind as StaffKind)}.`, 'info');
    },
  });
}

function unrecruitStaff(ctx: HandlerContext, housingRoomId: string): void {
  const { game } = ctx;
  if (game.phase !== 'day') return;

  const room = game.tower.rooms.find((r) => r.id === housingRoomId);
  if (!room || !isHousingRoom(room)) return;

  const recruited = game.housingRecruited[housingRoomId] ?? 0;
  if (recruited <= HOUSING_MIN_RECRUITED) {
    addMessage(game, 'Cannot unrecruit below the housing minimum.', 'info');
    return;
  }

  enqueueSideJob(game, 'unrecruit', 'Unrecruiting staff', RECRUIT_SIDE_JOB_SEC, {
    housingRoomId,
    onComplete: (state: GameState, payload: Record<string, unknown>) => {
      const id = payload.housingRoomId as string;
      state.housingRecruited[id] = (state.housingRecruited[id] ?? 0) - 1;
      addMessage(state, 'Unrecruited staff member.', 'info');
    },
  });
}

function setSlotAllocation(ctx: HandlerContext, slotRoomId: string, count: number): void {
  const { game } = ctx;
  if (game.phase !== 'day') return;

  const room = game.tower.rooms.find((r) => r.id === slotRoomId);
  if (!room || !isSlotRoom(room)) return;

  const max = slotCapacity(room);
  const clamped = Math.max(0, Math.min(max, Math.floor(count)));
  if ((game.slotAllocations[slotRoomId] ?? 0) === clamped) return;
  game.slotAllocations[slotRoomId] = clamped;
}

function setManaSpringAllocation(ctx: HandlerContext, springRoomId: string, count: number): void {
  const { game } = ctx;
  if (game.phase !== 'day') return;

  const room = game.tower.rooms.find((r) => r.id === springRoomId);
  if (!room || !isManaSpringRoom(room)) return;

  const clamped = Math.max(0, Math.min(MANA_SPRING_STAFF_CAPACITY, Math.floor(count)));
  if ((game.manaSpringAllocations[springRoomId] ?? 0) === clamped) return;
  game.manaSpringAllocations[springRoomId] = clamped;
}

function setResearchAllocation(ctx: HandlerContext, researchRoomId: string, count: number): void {
  const { game } = ctx;
  if (game.phase !== 'day') return;

  const room = game.tower.rooms.find((r) => r.id === researchRoomId);
  if (!room || !isResearchRoom(room)) return;

  const clamped = Math.max(0, Math.min(RESEARCH_ROOM_STAFF_CAPACITY, Math.floor(count)));
  if ((game.researchRoomAllocations[researchRoomId] ?? 0) === clamped) return;
  game.researchRoomAllocations[researchRoomId] = clamped;
}

function setProspectAllocation(ctx: HandlerContext, count: number): void {
  const { game } = ctx;
  if (game.phase !== 'day') return;

  let totalLaborers = 0;
  for (const room of game.tower.rooms) {
    if (room.blueprintId !== 'quartersRoom') continue;
    totalLaborers += game.housingRecruited[room.id] ?? 0;
  }

  const max = Math.min(PROSPECT_MAX_ALLOCATION, totalLaborers);
  const clamped = Math.max(0, Math.min(max, Math.floor(count)));
  if (game.prospectAllocation === clamped) return;
  game.prospectAllocation = clamped;
}
