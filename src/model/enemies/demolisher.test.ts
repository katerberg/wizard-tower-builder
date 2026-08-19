import { describe, expect, it } from 'vitest';
import { ENEMY_ATTACK_COOLDOWN, FIXED_DT } from '@/config/constants';
import { isWalkable } from '@/calculations/exteriorGraph';
import { findPath } from '@/calculations/pathfinding';
import { exteriorSubAt } from '@/calculations/subGrid';
import { getBlueprint } from '@/model/blueprints';
import { ENEMY_TEMPLATES, PLANNING_UNDER_OVERHANG } from '@/model/enemies';
import {
  attackOverhangBlocking,
  overhangCeilingMacro,
} from '@/model/enemies/demolisherCombat';
import { createInitialState, step } from '@/model/game';
import { placeInfra } from '@/model/infra';
import { SPIKES_DAMAGE_PER_LEVEL } from '@/model/modifications/spikes';
import { lockPipeFluids } from '@/model/pipes';
import { clearStaffAfterWave } from '@/model/staff';
import {
  applyDestructionAftermath,
  roomRemovalDelta,
} from '@/model/staff/destruction';
import {
  cascadeUnsupportedStructures,
  createRoom,
  createStructure,
  createTower,
  getUnstableStructureIds,
  hasStructure,
  isTowerStable,
  placeRoom,
  placeStructure,
  removeStructure,
  roomAt,
  structureAt,
} from '@/model/tower';
import type { Enemy, MovementProfile } from '@/model/types';
import { heightProgression, buildSpawnQueue, unlockEnemiesForHeight } from '@/model/waves';

const attackOverhang: MovementProfile = ENEMY_TEMPLATES.demolisher.movement;

function tCapTower() {
  let tower = createTower();
  tower = placeStructure(tower, createStructure('a', getBlueprint('stem')!, { col: 5, row: 0 }));
  tower = placeStructure(tower, createStructure('b', getBlueprint('stem')!, { col: 5, row: 1 }));
  tower = placeStructure(tower, createStructure('c', getBlueprint('buttress3')!, { col: 4, row: 2 }));
  return tower;
}

function makeDemolisher(pos: { col: number; row: number }, templateId = 'demolisher'): Enemy {
  return {
    id: 'demo-1',
    templateId,
    name: 'Sapper',
    pos: { col: pos.col, row: pos.row, face: 'left' },
    path: [],
    pathIndex: 0,
    currentHp: ENEMY_TEMPLATES[templateId].stats.maxHp,
    moveCooldown: 0,
    attackCooldown: 0,
  };
}

describe('demolisher templates', () => {
  it('uses attack_overhang and a size ladder', () => {
    expect(ENEMY_TEMPLATES.demolisher.movement.kind).toBe('attack_overhang');
    expect(ENEMY_TEMPLATES.demolisher.movement.canPassUnderOverhang).toBe(false);
    expect(ENEMY_TEMPLATES.demolisher.movement.canAttackOverhang).toBe(true);
    expect(ENEMY_TEMPLATES.demolisher.sizeTier).toBe('small');
    expect(ENEMY_TEMPLATES.demolisherElite.sizeTier).toBe('medium');
    expect(ENEMY_TEMPLATES.demolisherBrute.sizeTier).toBe('large');
  });
});

describe('attack_overhang walkability', () => {
  it('rejects underCeiling cells like surface_climb', () => {
    const tower = tCapTower();
    const under = { col: 12, row: 5 };
    expect(isWalkable(tower, under.col, under.row, PLANNING_UNDER_OVERHANG)).toBe(true);
    expect(isWalkable(tower, under.col, under.row, attackOverhang)).toBe(false);
  });
});

describe('preferred-path overhang smash', () => {
  it('identifies the ceiling macro cell above a blocked path node', () => {
    const tower = tCapTower();
    const under = { col: 12, row: 5, face: 'top' as const };
    const ceiling = overhangCeilingMacro(tower, under);
    expect(ceiling).toEqual({ col: 4, row: 2 });
  });

  it('damages room first, then framing, then continues after clear', () => {
    let tower = tCapTower();
    const roomBp = getBlueprint('guardroomRoom')!;
    tower = placeRoom(tower, createRoom('capRoom', roomBp, { col: 4, row: 2 }));
    // Cap room sits on buttress cell (4,2); also need rooms only on one cell of buttress.
    const state = createInitialState('demo-smash');
    state.phase = 'night';
    state.tower = tower;

    const under = { col: 12, row: 5 };
    const enemy = makeDemolisher(under);
    state.enemies = [enemy];

    const room = roomAt(state.tower, 4, 2)!;
    const roomHpBefore = room.hp;
    expect(attackOverhangBlocking(state, enemy, ENEMY_TEMPLATES.demolisher, {
      col: under.col,
      row: under.row,
      face: 'top',
    }, ENEMY_ATTACK_COOLDOWN)).toBe(true);

    const afterHit = roomAt(state.tower, 4, 2);
    expect(afterHit).toBeTruthy();
    expect(afterHit!.hp).toBeLessThan(roomHpBefore);

    // Finish the room.
    afterHit!.hp = 1;
    enemy.attackCooldown = 0;
    attackOverhangBlocking(state, enemy, ENEMY_TEMPLATES.demolisher, {
      col: under.col,
      row: under.row,
      face: 'top',
    }, ENEMY_ATTACK_COOLDOWN);
    expect(roomAt(state.tower, 4, 2)).toBeUndefined();
    expect(structureAt(state.tower, 4, 2)).toBeTruthy();

    // Next swings hit framing.
    const framing = structureAt(state.tower, 4, 2)!;
    const framingHp = framing.hp;
    enemy.attackCooldown = 0;
    attackOverhangBlocking(state, enemy, ENEMY_TEMPLATES.demolisher, {
      col: under.col,
      row: under.row,
      face: 'top',
    }, ENEMY_ATTACK_COOLDOWN);
    expect(structureAt(state.tower, 4, 2)!.hp).toBeLessThan(framingHp);
  });

  it('plans under_overhang path but cannot step into underCeiling without smashing', () => {
    const tower = tCapTower();
    const start = { ...exteriorSubAt(5, 1, 'left'), face: 'left' as const };
    const goal = { col: 12, row: 5, face: 'top' as const };
    // Path toward under-cap using planning profile.
    const planned = findPath(tower, start, goal, PLANNING_UNDER_OVERHANG);
    expect(planned.length).toBeGreaterThan(1);
    const blocked = planned.find((n) => !isWalkable(tower, n.col, n.row, attackOverhang));
    expect(blocked).toBeTruthy();
  });
});

describe('cascadeUnsupportedStructures', () => {
  it('removes floating stems after mid support is destroyed', () => {
    let tower = createTower();
    const stem = getBlueprint('stem')!;
    tower = placeStructure(tower, createStructure('s0', stem, { col: 5, row: 0 }));
    tower = placeStructure(tower, createStructure('s1', stem, { col: 5, row: 1 }));
    tower = placeStructure(tower, createStructure('s2', stem, { col: 5, row: 2 }));
    tower = removeStructure(tower, 's1');
    expect(isTowerStable(tower)).toBe(false);
    expect(getUnstableStructureIds(tower).has('s2')).toBe(true);

    const { tower: next, delta } = cascadeUnsupportedStructures(tower);
    expect(isTowerStable(next)).toBe(true);
    expect(hasStructure(next, 5, 2)).toBe(false);
    expect(delta.removedStructureIds).toContain('s2');
  });
});

describe('pipe re-lock on destruction', () => {
  it('re-resolves fluids when a steam turret room is destroyed', () => {
    let tower = createTower();
    tower = placeStructure(tower, createStructure('g5', getBlueprint('stem')!, { col: 5, row: 0 }));
    tower = placeStructure(tower, createStructure('tStem', getBlueprint('stem')!, { col: 5, row: 1 }));
    tower = placeStructure(tower, createStructure('s0', getBlueprint('stem')!, { col: 4, row: 0 }));
    tower = placeStructure(tower, createStructure('s1', getBlueprint('stem')!, { col: 4, row: 1 }));
    tower = placeRoom(tower, createRoom('turret', getBlueprint('steamTurretRoom')!, { col: 5, row: 1 }));
    tower = placeInfra(tower, { col: 4, row: 1 }, 'pipe');
    tower = lockPipeFluids(tower);
    expect(tower.infra['4,1']?.fluid).toBe('steam');

    const state = createInitialState('pipe-break');
    state.phase = 'night';
    state.tower = tower;
    const delta = roomRemovalDelta(state, 'turret');
    state.tower = {
      ...state.tower,
      rooms: state.tower.rooms.filter((r) => r.id !== 'turret'),
      occupancy: Object.fromEntries(
        Object.entries(state.tower.occupancy).filter(([, id]) => id !== 'turret'),
      ),
    };
    applyDestructionAftermath(state, delta);
    expect(state.tower.infra['4,1']?.fluid).toBe('unassigned');
  });
});

describe('staff destruction aftermath', () => {
  it('kills staff on destroyed cells and rehomes when spare capacity exists', () => {
    const state = createInitialState('staff-demo');
    state.phase = 'night';
    const stem = getBlueprint('stem')!;
    const quarters = getBlueprint('quartersRoom')!;
    state.tower = createTower();
    state.tower = placeStructure(state.tower, createStructure('qa', stem, { col: 3, row: 0 }));
    state.tower = placeStructure(state.tower, createStructure('qb', stem, { col: 5, row: 0 }));
    state.tower = placeRoom(state.tower, createRoom('q1', quarters, { col: 3, row: 0 }));
    state.tower = placeRoom(state.tower, createRoom('q2', quarters, { col: 5, row: 0 }));
    state.housingRecruited = { q1: 1, q2: 0 };
    state.staff = [
      {
        id: 'l1',
        kind: 'laborer',
        homeHousingId: 'q1',
        targetWorkplaceId: null,
        pos: { col: 3, row: 0 },
        path: [],
        pathIndex: 0,
        moveCooldown: 0,
        status: 'idle',
      },
      {
        id: 'l2',
        kind: 'laborer',
        homeHousingId: 'q1',
        targetWorkplaceId: null,
        pos: { col: 4, row: 0 },
        path: [],
        pathIndex: 0,
        moveCooldown: 0,
        status: 'idle',
      },
    ];

    // Destroy q1 with l1 on the footprint; l2 is safe and should rehome to q2.
    const delta = roomRemovalDelta(state, 'q1');
    state.tower = {
      ...state.tower,
      rooms: state.tower.rooms.filter((r) => r.id !== 'q1'),
      occupancy: Object.fromEntries(
        Object.entries(state.tower.occupancy).filter(([, id]) => id !== 'q1'),
      ),
    };
    applyDestructionAftermath(state, delta);

    expect(state.staff.find((s) => s.id === 'l1')).toBeUndefined();
    const survivor = state.staff.find((s) => s.id === 'l2');
    expect(survivor).toBeTruthy();
    expect(survivor!.homeHousingId).toBe('q2');
    expect(state.housingRecruited.q1).toBeUndefined();
    expect(state.housingRecruited.q2).toBe(1);
  });

  it('leaves homeless staff until clearStaffAfterWave', () => {
    const state = createInitialState('staff-homeless');
    state.phase = 'night';
    const stem = getBlueprint('stem')!;
    const quarters = getBlueprint('quartersRoom')!;
    state.tower = createTower();
    state.tower = placeStructure(state.tower, createStructure('qa', stem, { col: 3, row: 0 }));
    state.tower = placeRoom(state.tower, createRoom('q1', quarters, { col: 3, row: 0 }));
    state.housingRecruited = { q1: 1 };
    state.staff = [
      {
        id: 'l1',
        kind: 'laborer',
        homeHousingId: 'q1',
        targetWorkplaceId: null,
        pos: { col: 4, row: 0 },
        path: [],
        pathIndex: 0,
        moveCooldown: 0,
        status: 'idle',
      },
    ];
    const delta = roomRemovalDelta(state, 'q1');
    state.tower = {
      ...state.tower,
      rooms: [],
      occupancy: {},
    };
    applyDestructionAftermath(state, delta);
    expect(state.staff).toHaveLength(1);
    expect(state.staff[0].homeHousingId).toBe('');
    clearStaffAfterWave(state);
    expect(state.staff).toHaveLength(0);
  });
});

describe('spikes on room attack', () => {
  it('damages the demolisher each swing against a spiked room', () => {
    let tower = tCapTower();
    const room = createRoom('capRoom', getBlueprint('guardroomRoom')!, { col: 4, row: 2 });
    room.modifications = [{ id: 'spikes', level: 1 }];
    tower = placeRoom(tower, room);
    const state = createInitialState('spike-smash');
    state.phase = 'night';
    state.tower = tower;
    const enemy = makeDemolisher({ col: 12, row: 5 }, 'demolisherBrute');
    const hpBefore = enemy.currentHp;
    state.enemies = [enemy];
    attackOverhangBlocking(state, enemy, ENEMY_TEMPLATES.demolisherBrute, {
      col: 12,
      row: 5,
      face: 'top',
    }, ENEMY_ATTACK_COOLDOWN);
    expect(enemy.currentHp).toBe(hpBefore - SPIKES_DAMAGE_PER_LEVEL);
  });
});

describe('demolisher wave pressure', () => {
  it('unlocks demolishers at height 30 and caps slots', () => {
    const unlocked = new Set(unlockEnemiesForHeight([], 30));
    expect(unlocked.has('demolisher')).toBe(true);
    expect(unlocked.has('demolisherElite')).toBe(false);
    const queue = buildSpawnQueue(
      heightProgression.getWave({ height: 30, unlockedEnemyIds: unlocked }),
    );
    const demolishers = queue.filter((id) => id.startsWith('demolisher'));
    expect(demolishers.length).toBeGreaterThan(0);
    expect(demolishers.length).toBeLessThanOrEqual(1);
  });

  it('prefers heavier demolisher tiers within the shared slot budget', () => {
    const unlocked = new Set(unlockEnemiesForHeight([], 80));
    const queue = buildSpawnQueue(
      heightProgression.getWave({ height: 80, unlockedEnemyIds: unlocked }),
    );
    const total = queue.filter((id) => id.startsWith('demolisher')).length;
    expect(total).toBeGreaterThan(0);
    expect(total).toBeLessThanOrEqual(2);
    expect(queue.some((id) => id === 'demolisherBrute' || id === 'demolisherElite')).toBe(true);
  });
});

describe('demolisher tick integration', () => {
  it('idles when preferred path is empty rather than crawling under', () => {
    const state = createInitialState('demo-idle');
    state.phase = 'night';
    // Isolated stem with no path graph connectivity for a weird start — use overhang cell
    // with empty path so the demolisher branch idles.
    state.tower = tCapTower();
    const enemy = makeDemolisher({ col: 12, row: 5 });
    enemy.path = [];
    enemy.pathIndex = 0;
    // Force empty path after repath by placing enemy where planning also fails (far air).
    enemy.pos = { col: 0, row: 20, face: 'air' };
    state.enemies = [enemy];
    const hp = enemy.currentHp;
    step(state, FIXED_DT);
    expect(enemy.currentHp).toBe(hp);
    expect(enemy.pos).toEqual({ col: 0, row: 20, face: 'air' });
  });
});
