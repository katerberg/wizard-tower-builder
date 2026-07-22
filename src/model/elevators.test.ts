import { describe, expect, it } from 'vitest';
import { ELEVATOR_CAPACITY, SOLDIER_RECRUIT_COST } from '@/config/constants';
import { canSoldierTraverse, isSoldierWalkable } from '@/calculations/interiorGraph';
import { findInteriorPath } from '@/calculations/interiorPathfinding';
import { createInitialState } from '@/model/game';
import { getBlueprint } from '@/model/blueprints';
import { placeInfra } from '@/model/infra';
import { getInfraBlueprint } from '@/model/infraBlueprints';
import {
  discoverElevatorShafts,
  initElevators,
  isElevatorVerticalStep,
  stepElevators,
} from '@/model/elevators';
import { createRoom,
  createStructure, createTower, placeRoom,
  placeStructure } from '@/model/tower';
import { deployStaffForWave, stepStaff } from '@/model/staff';

function towerWithElevatorShaft() {
  const state = createInitialState('elevator-base');
  state.tower = createTower();
  const stem = getBlueprint('stem')!;
  const guardroomBp = getBlueprint('guardroomRoom')!;
  const slotBp = getBlueprint('slotRoom')!;
  for (const row of [0, 1, 2, 3]) {
    state.tower = placeStructure(state.tower, createStructure(`m${row}`, stem, { col: 3, row }));
  }
  state.tower = placeRoom(state.tower, createRoom('b1', guardroomBp, { col: 3, row: 0 }));
  state.tower = placeRoom(state.tower, createRoom('s1', slotBp, { col: 3, row: 3 }));
  for (const row of [0, 1, 2, 3]) {
    state.tower = placeInfra(state.tower, { col: 3, row }, 'elevator');
  }
  return state;
}

describe('elevator shaft discovery', () => {
  it('treats a contiguous column as one shaft', () => {
    let tower = createTower();
    for (const row of [0, 1, 2]) {
      tower = placeInfra(tower, { col: 2, row }, 'elevator');
    }
    const shafts = discoverElevatorShafts(tower);
    expect(shafts).toHaveLength(1);
    expect(shafts[0]).toMatchObject({ col: 2, minRow: 0, maxRow: 2 });
  });

  it('splits a gapped column into two shafts', () => {
    let tower = createTower();
    tower = placeInfra(tower, { col: 2, row: 0 }, 'elevator');
    tower = placeInfra(tower, { col: 2, row: 1 }, 'elevator');
    tower = placeInfra(tower, { col: 2, row: 3 }, 'elevator');
    tower = placeInfra(tower, { col: 2, row: 4 }, 'elevator');
    const shafts = discoverElevatorShafts(tower);
    expect(shafts).toHaveLength(2);
    expect(shafts.map((s) => `${s.minRow}-${s.maxRow}`).sort()).toEqual(['0-1', '3-4']);
  });

  it('treats adjacent columns as separate shafts', () => {
    let tower = createTower();
    tower = placeInfra(tower, { col: 2, row: 0 }, 'elevator');
    tower = placeInfra(tower, { col: 2, row: 1 }, 'elevator');
    tower = placeInfra(tower, { col: 3, row: 0 }, 'elevator');
    tower = placeInfra(tower, { col: 3, row: 1 }, 'elevator');
    const shafts = discoverElevatorShafts(tower);
    expect(shafts).toHaveLength(2);
    expect(new Set(shafts.map((s) => s.col))).toEqual(new Set([2, 3]));
  });
});

describe('elevator interior graph', () => {
  it('allows vertical pathfinding through a shaft but marks elevator vertical steps', () => {
    const state = towerWithElevatorShaft();
    expect(isSoldierWalkable(state.tower, 3, 1)).toBe(true);
    expect(canSoldierTraverse(state.tower, { col: 3, row: 0 }, { col: 3, row: 1 })).toBe(true);
    expect(isElevatorVerticalStep(state.tower, { col: 3, row: 0 }, { col: 3, row: 1 })).toBe(true);
    const path = findInteriorPath(state.tower, { col: 3, row: 0 }, { col: 3, row: 3 });
    expect(path.length).toBeGreaterThan(0);
    expect(path[path.length - 1]).toEqual({ col: 3, row: 3 });
  });

  it('allows horizontal walk across elevator cells for adjacent-shaft transfer', () => {
    let tower = createTower();
    const stem = getBlueprint('stem')!;
    tower = placeStructure(tower, createStructure('a', stem, { col: 4, row: 0 }));
    tower = placeStructure(tower, createStructure('b', stem, { col: 5, row: 0 }));
    tower = placeInfra(tower, { col: 4, row: 0 }, 'elevator');
    tower = placeInfra(tower, { col: 5, row: 0 }, 'elevator');
    expect(canSoldierTraverse(tower, { col: 4, row: 0 }, { col: 5, row: 0 })).toBe(true);
  });
});

describe('elevator runtime', () => {
  it('makes staff wait for the car instead of free-climbing', () => {
    const state = towerWithElevatorShaft();
    state.housingRecruited.b1 = 1;
    state.slotAllocations.s1 = 1;
    state.buildRecruitSpend = SOLDIER_RECRUIT_COST;
    deployStaffForWave(state);
    initElevators(state);

    const soldier = state.staff[0];
    soldier.moveCooldown = 0;
    stepStaff(state, 1);
    expect(soldier.status).toBe('waiting_elevator');
    expect(soldier.pos).toEqual({ col: 3, row: 0 });
  });

  it('calls an idle car, boards, and rides to the exit floor', () => {
    const state = towerWithElevatorShaft();
    state.housingRecruited.b1 = 1;
    state.slotAllocations.s1 = 1;
    state.buildRecruitSpend = SOLDIER_RECRUIT_COST;
    deployStaffForWave(state);
    initElevators(state);

    const soldier = state.staff[0];
    soldier.moveCooldown = 0;
    stepStaff(state, 1);
    expect(soldier.status).toBe('waiting_elevator');

    // Car is already at bottom — board and travel up.
    for (let i = 0; i < 20; i++) {
      stepElevators(state, 1);
      stepStaff(state, 1);
      if (soldier.status === 'stationed') break;
    }
    expect(soldier.status).toBe('stationed');
    expect(soldier.pos).toEqual({ col: 3, row: 3 });
  });

  it('caps a car at ELEVATOR_CAPACITY and leaves extras waiting', () => {
    const state = towerWithElevatorShaft();
    // Expand guardroom capacity via recruit count; slot needs headroom.
    state.housingRecruited.b1 = ELEVATOR_CAPACITY + 1;
    state.slotAllocations.s1 = ELEVATOR_CAPACITY + 1;
    // Slot base capacity is 2 — place enough slots.
    const slotBp = getBlueprint('slotRoom')!;
    const stem = getBlueprint('stem')!;
    for (let i = 0; i < ELEVATOR_CAPACITY; i++) {
      const id = `sExtra${i}`;
      const col = 4 + (i % 4);
      if (!state.tower.structureOccupancy[`${col},3`]) {
        state.tower = placeStructure(state.tower, createStructure(`stem${col}`, stem, { col, row: 3 }));
      }
      state.tower = placeRoom(state.tower, createRoom(id, slotBp, { col, row: 3 }));
      state.slotAllocations[id] = 1;
    }
    // Ensure row 3 walkable horizontally from elevator.
    for (let c = 4; c <= 7; c++) {
      if (!state.tower.structureOccupancy[`${c},3`]) {
        state.tower = placeStructure(state.tower, createStructure(`stem${c}`, stem, { col: c, row: 3 }));
      }
    }
    state.slotAllocations.s1 = 1;
    state.buildRecruitSpend = SOLDIER_RECRUIT_COST * (ELEVATOR_CAPACITY + 1);

    deployStaffForWave(state);
    initElevators(state);

    for (const unit of state.staff) unit.moveCooldown = 0;
    stepStaff(state, 1);
    const waiters = state.staff.filter((s) => s.status === 'waiting_elevator');
    expect(waiters.length).toBeGreaterThanOrEqual(ELEVATOR_CAPACITY);

    stepElevators(state, 1);
    const car = state.elevators[0];
    expect(car.passengers.length).toBe(ELEVATOR_CAPACITY);
    const stillWaiting = state.staff.filter((s) => s.status === 'waiting_elevator');
    expect(stillWaiting.length).toBeGreaterThanOrEqual(1);
  });

  it('picks up same-direction waiters mid-route when capacity remains', () => {
    const state = towerWithElevatorShaft();
    state.housingRecruited.b1 = 2;
    state.slotAllocations.s1 = 2;
    state.buildRecruitSpend = SOLDIER_RECRUIT_COST * 2;
    deployStaffForWave(state);
    initElevators(state);

    const [a, b] = state.staff;
    // Only a starts waiting at the bottom; b waits at an intermediate floor.
    for (const unit of state.staff) unit.moveCooldown = 99;
    a.moveCooldown = 0;
    stepStaff(state, 1);
    expect(a.status).toBe('waiting_elevator');

    b.pos = { col: 3, row: 1 };
    b.path = [
      { col: 3, row: 1 },
      { col: 3, row: 2 },
      { col: 3, row: 3 },
    ];
    b.pathIndex = 0;
    b.status = 'waiting_elevator';
    b.elevatorShaftId = a.elevatorShaftId;
    b.elevatorExitRow = 3;
    b.elevatorExitPathIndex = 2;
    b.elevatorWaitElapsed = 0;

    // Small dt: board a at 0 without yet reaching floor 1.
    stepElevators(state, 0.01);
    expect(state.elevators[0].passengers).toContain(a.id);
    expect(state.elevators[0].passengers).not.toContain(b.id);
    expect(state.elevators[0].row).toBe(0);

    // Travel until the car picks up b at row 1.
    for (let i = 0; i < 20; i++) {
      stepElevators(state, 0.5);
      if (state.elevators[0].passengers.includes(b.id)) break;
    }
    expect(state.elevators[0].passengers).toContain(a.id);
    expect(state.elevators[0].passengers).toContain(b.id);
  });
});

describe('elevator blueprint', () => {
  it('exposes an elevator infra blueprint', () => {
    const bp = getInfraBlueprint('elevator');
    expect(bp?.infraKind).toBe('elevator');
    expect(bp?.cost).toBeGreaterThan(getInfraBlueprint('staircase')!.cost);
  });
});
