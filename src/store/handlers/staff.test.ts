import { describe, expect, it, vi } from 'vitest';
import { GUARDROOM_BASE_CAPACITY, SOLDIER_RECRUIT_COST } from '@/config/constants';
import { createInitialState } from '@/model/game';
import { getBlueprint } from '@/model/blueprints';
import { createRoom, placeRoom } from '@/model/tower';
import { effectiveHousingRecruited } from '@/model/staff/capacity';
import { handleStaffIntent } from './staff';
import type { HandlerContext } from '../context';

function recruitContext(state = createInitialState('recruit-cap')): {
  ctx: HandlerContext;
  housingRoomId: string;
} {
  const game = state;
  const guardroom = createRoom('b1', getBlueprint('guardroomRoom')!, { col: 4, row: 0 });
  game.tower = placeRoom(game.tower, guardroom);
  game.housingRecruited[guardroom.id] = 1;
  game.player.resources.gold = 999;
  const ctx: HandlerContext = {
    game,
    view: {
      selectedBlueprintId: null,
      selectedSpellId: null,
      hoveredCell: null,
      castAnchor: null,
      modal: null,
      cameraScrollY: 0,
      viewportHeight: 600,
      layerVisibility: { rooms: true, infra: true, workers: true },
      connectivityFocusSlotId: null,
      waveBuilder: { open: false, counts: {} },
      selectedResearchNodeId: null,
      researchExpandedGroupIds: [],
    },
    buildHistory: [],
    nextRoomId: () => 'room-test',
    recordBuildStep: vi.fn(),
    clearBuildHistory: vi.fn(),
    closeModalIfRoomMissing: vi.fn(),
  };
  return { ctx, housingRoomId: guardroom.id };
}

describe('recruitStaff capacity', () => {
  it('counts in-flight recruit jobs against housing capacity', () => {
    const { ctx, housingRoomId } = recruitContext();
    const capacity = GUARDROOM_BASE_CAPACITY;
    const allowed = capacity - effectiveHousingRecruited(ctx.game, housingRoomId);

    for (let i = 0; i < allowed + 5; i += 1) {
      handleStaffIntent(ctx, { type: 'recruitStaff', housingRoomId });
    }

    const recruitJobs = ctx.game.sideJobs.filter((job) => job.kind === 'recruit');
    expect(recruitJobs).toHaveLength(allowed);
    expect(effectiveHousingRecruited(ctx.game, housingRoomId)).toBe(capacity);
  });

  it('reserves recruit gold when the side job starts', () => {
    const { ctx, housingRoomId } = recruitContext();

    handleStaffIntent(ctx, { type: 'recruitStaff', housingRoomId });

    expect(ctx.game.pendingRecruitSpend).toBe(SOLDIER_RECRUIT_COST);
    expect(ctx.game.sideJobs.some((job) => job.kind === 'recruit')).toBe(true);
  });
});
