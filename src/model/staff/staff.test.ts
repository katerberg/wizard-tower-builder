import { describe, expect, it } from 'vitest';
import {
  GUARDROOM_BASE_CAPACITY,
  LABORER_REPAIR_HP_PER_SEC,
  MANA_SPRING_MAGE_EFFICIENCY,
  MANA_SPRING_PER_SEC,
  SOLDIER_RECRUIT_COST,
  SOLDIER_UPKEEP_COST,
} from '@/config/constants';
import { createInitialState } from '@/model/game';
import { getBlueprint } from '@/model/blueprints';
import { createRoom, createTower, placeRoom } from '@/model/tower';
import { placeInfra } from '@/model/infra';
import { tickManaSprings } from '@/model/manaSprings';
import {
  deployStaffForWave,
  housingCapacity,
  seedSpecialtyRoomDefaults,
  stepStaff,
  tickLaborerRepairs,
  totalRecruitedSoldiers,
} from '@/model/staff';

function towerWithStairShaft() {
  const state = createInitialState('soldier-stairs');
  state.tower = createTower();
  const guardroomBp = getBlueprint('guardroomRoom')!;
  const slotBp = getBlueprint('slotRoom')!;
  state.tower = placeRoom(state.tower, createRoom('b1', guardroomBp, { col: 3, row: 0 }));
  state.tower = placeRoom(state.tower, createRoom('s1', slotBp, { col: 3, row: 2 }));
  state.tower = placeInfra(state.tower, { col: 3, row: 0 }, 'stair');
  state.tower = placeInfra(state.tower, { col: 3, row: 1 }, 'stair');
  state.tower = placeInfra(state.tower, { col: 3, row: 2 }, 'stair');
  return state;
}

describe('specialty room defaults', () => {
  it('seeds one recruit and workplace allocations', () => {
    const state = createInitialState('seed-defaults');
    const guardroom = createRoom('b1', getBlueprint('guardroomRoom')!, { col: 4, row: 0 });
    const slot = createRoom('s1', getBlueprint('slotRoom')!, { col: 10, row: 0 });
    const spring = createRoom('m1', getBlueprint('manaSpringRoom')!, { col: 6, row: 0 });
    seedSpecialtyRoomDefaults(state, guardroom);
    seedSpecialtyRoomDefaults(state, slot);
    seedSpecialtyRoomDefaults(state, spring);
    expect(state.housingRecruited.b1).toBe(1);
    expect(state.slotAllocations.s1).toBe(1);
    expect(state.manaSpringAllocations.m1).toBe(1);
  });
});

describe('soldier deployment', () => {
  it('charges upkeep for all recruited and spawns allocated soldiers', () => {
    const state = towerWithStairShaft();
    state.housingRecruited.b1 = 2;
    state.slotAllocations.s1 = 1;
    state.buildRecruitSpend = SOLDIER_RECRUIT_COST * 2;
    const before = state.player.currency;

    deployStaffForWave(state);

    expect(state.staff.filter((s) => s.kind === 'soldier')).toHaveLength(1);
    expect(state.player.currency).toBe(before - SOLDIER_UPKEEP_COST * 2);
    expect(state.staff[0].path.length).toBeGreaterThan(0);
  });

  it('respects guardroom capacity', () => {
    const room = createRoom('b1', getBlueprint('guardroomRoom')!, { col: 0, row: 0 });
    expect(housingCapacity(room)).toBe(GUARDROOM_BASE_CAPACITY);
  });
});

describe('staff stair queuing', () => {
  it('queues only on shared cells, not the whole stair column', () => {
    const state = towerWithStairShaft();
    state.housingRecruited.b1 = 2;
    state.slotAllocations.s1 = 2;
    state.buildRecruitSpend = SOLDIER_RECRUIT_COST * 2;

    deployStaffForWave(state);
    const soldiers = state.staff.filter((s) => s.kind === 'soldier');
    expect(soldiers).toHaveLength(2);

    const [first, second] = soldiers;
    expect(first.pos).toEqual({ col: 3, row: 0 });
    expect(second.pos).toEqual({ col: 3, row: 0 });

    first.moveCooldown = 0;
    second.moveCooldown = 0;

    stepStaff(state, 1);
    expect(first.pos).toEqual({ col: 3, row: 1 });
    // Next cell occupied — follower stays put.
    expect(second.pos).toEqual({ col: 3, row: 0 });

    second.moveCooldown = 99;
    first.moveCooldown = 0;
    stepStaff(state, 1);
    expect(first.status).toBe('stationed');
    expect(first.pos).toEqual({ col: 3, row: 2 });
    expect(second.pos).toEqual({ col: 3, row: 0 });

    // Lead is already off the mid stair; follower may climb while lead stays stationed.
    second.moveCooldown = 0;
    stepStaff(state, 1);
    expect(second.pos).toEqual({ col: 3, row: 1 });
    expect(first.pos).toEqual({ col: 3, row: 2 });
  });

  it('allows multiple stationed soldiers to share the destination slot', () => {
    const state = towerWithStairShaft();
    state.housingRecruited.b1 = 2;
    state.slotAllocations.s1 = 2;
    state.buildRecruitSpend = SOLDIER_RECRUIT_COST * 2;
    deployStaffForWave(state);

    for (let i = 0; i < 20; i++) {
      for (const s of state.staff) s.moveCooldown = 0;
      stepStaff(state, 1);
    }

    const soldiers = state.staff.filter((s) => s.kind === 'soldier');
    expect(soldiers.every((s) => s.status === 'stationed')).toBe(true);
    expect(soldiers.every((s) => s.pos.col === 3 && s.pos.row === 2)).toBe(true);
  });

  it('deserts unpaid staff from the housing roster', () => {
    const state = towerWithStairShaft();
    state.housingRecruited.b1 = 1;
    state.slotAllocations.s1 = 1;
    state.player.currency = 0;

    deployStaffForWave(state);

    expect(state.staff.filter((s) => s.kind === 'soldier')).toHaveLength(0);
    expect(state.housingRecruited.b1).toBe(0);
  });
});

describe('magi + mana springs', () => {
  function springWithChamber() {
    const state = createInitialState('mage-spring');
    state.tower = createTower();
    // Staff shaft col 4; spring at (5,0); water adjacent on col 7.
    state.tower = placeRoom(
      state.tower,
      createRoom('g0', getBlueprint('stem')!, { col: 4, row: 0 }),
    );
    state.tower = placeRoom(
      state.tower,
      createRoom('g1', getBlueprint('stem')!, { col: 4, row: 1 }),
    );
    state.tower = placeRoom(
      state.tower,
      createRoom('spring', getBlueprint('manaSpringRoom')!, { col: 5, row: 0 }),
    );
    state.tower = placeRoom(
      state.tower,
      createRoom('w0', getBlueprint('stem')!, { col: 7, row: 0 }),
    );
    state.tower = placeRoom(
      state.tower,
      createRoom('w1', getBlueprint('stem')!, { col: 7, row: 1 }),
    );
    state.tower = placeRoom(
      state.tower,
      createRoom('ch', getBlueprint('chamberRoom')!, { col: 4, row: 2 }),
    );
    state.tower = placeInfra(state.tower, { col: 7, row: 0 }, 'pipe');
    state.tower = placeInfra(state.tower, { col: 7, row: 1 }, 'pipe');
    // Full stair shaft so magi can descend to the spring on row 0.
    state.tower = placeInfra(state.tower, { col: 4, row: 0 }, 'stair');
    state.tower = placeInfra(state.tower, { col: 4, row: 1 }, 'stair');
    state.tower = placeInfra(state.tower, { col: 4, row: 2 }, 'stair');
    state.housingRecruited.ch = 2;
    state.manaSpringAllocations.spring = 2;
    state.player.currency = 100;
    return state;
  }

  it('does not regenerate mana without stationed magi', () => {
    const state = springWithChamber();
    state.housingRecruited.ch = 0;
    state.manaSpringAllocations.spring = 0;
    state.player.mana = 10;
    tickManaSprings(state, 1);
    expect(state.player.mana).toBe(10);
  });

  it('regenerates with diminishing returns for multiple magi', () => {
    const state = springWithChamber();
    deployStaffForWave(state);
    for (let i = 0; i < 40; i++) {
      for (const s of state.staff) s.moveCooldown = 0;
      stepStaff(state, 1);
    }
    const magi = state.staff.filter((s) => s.kind === 'mage' && s.status === 'stationed');
    expect(magi.length).toBe(2);

    state.player.mana = 10;
    tickManaSprings(state, 1);
    const expected =
      MANA_SPRING_PER_SEC * (MANA_SPRING_MAGE_EFFICIENCY[0] + MANA_SPRING_MAGE_EFFICIENCY[1]);
    expect(state.player.mana).toBeCloseTo(10 + expected, 5);
  });
});

describe('laborer repairs', () => {
  it('prefers singleton rooms then applies 50% falloff', () => {
    const state = createInitialState('labor');
    state.tower = createTower();
    state.tower = placeRoom(
      state.tower,
      createRoom('q1', getBlueprint('quartersRoom')!, { col: 3, row: 0 }),
    );
    state.tower = placeRoom(
      state.tower,
      createRoom('bridge4', getBlueprint('stem')!, { col: 4, row: 0 }),
    );
    state.tower = placeRoom(
      state.tower,
      createRoom('r1', getBlueprint('stem')!, { col: 5, row: 0 }),
    );
    state.tower = placeRoom(
      state.tower,
      createRoom('bridge6', getBlueprint('stem')!, { col: 6, row: 0 }),
    );
    state.tower = placeRoom(
      state.tower,
      createRoom('r2', getBlueprint('stem')!, { col: 7, row: 0 }),
    );
    state.housingRecruited.q1 = 3;
    state.player.currency = 100;

    const r1 = state.tower.rooms.find((r) => r.id === 'r1')!;
    const r2 = state.tower.rooms.find((r) => r.id === 'r2')!;
    r1.hp = 5;
    r2.hp = 5;

    deployStaffForWave(state);
    const laborers = state.staff.filter((s) => s.kind === 'laborer');
    expect(laborers).toHaveLength(3);

    // Immediate assign without pathing (same row, walkable).
    for (let i = 0; i < 20; i++) {
      for (const s of state.staff) s.moveCooldown = 0;
      stepStaff(state, 1);
    }

    const targets = new Map<string, number>();
    for (const l of laborers) {
      if (!l.targetWorkplaceId) continue;
      targets.set(l.targetWorkplaceId, (targets.get(l.targetWorkplaceId) ?? 0) + 1);
    }
    // Prefer spreading: each damaged room should have at least one before stacking.
    expect(targets.get('r1') ?? 0).toBeGreaterThanOrEqual(1);
    expect(targets.get('r2') ?? 0).toBeGreaterThanOrEqual(1);

    // Force both laborers onto r1 to check falloff math.
    for (const l of laborers) {
      l.targetWorkplaceId = 'r1';
      l.status = 'working';
      l.pos = { ...r1.origin };
    }
    const before = r1.hp;
    tickLaborerRepairs(state, 1);
    const expectedRate =
      LABORER_REPAIR_HP_PER_SEC * (1 + 0.5 + 0.25);
    expect(r1.hp).toBeCloseTo(Math.min(getBlueprint('stem')!.baseHp, before + expectedRate), 5);
  });
});

describe('recruitment totals', () => {
  it('sums recruited across guardrooms', () => {
    const state = createInitialState('sum');
    state.tower = createTower();
    state.tower = placeRoom(
      state.tower,
      createRoom('b1', getBlueprint('guardroomRoom')!, { col: 2, row: 0 }),
    );
    state.tower = placeRoom(
      state.tower,
      createRoom('b2', getBlueprint('guardroomRoom')!, { col: 4, row: 0 }),
    );
    state.housingRecruited = { b1: 2, b2: 3 };
    expect(totalRecruitedSoldiers(state)).toBe(5);
  });
});
