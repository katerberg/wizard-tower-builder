import { describe, expect, it } from 'vitest';
import { MANA_SPRING_PER_SEC, MAX_MANA } from '@/config/constants';
import { getBlueprint } from './blueprints';
import { placeInfra } from './infra';
import { createInitialState } from './game';
import { tickManaSprings } from './manaSprings';
import { selectPipeConnectivityReport } from './pipes';
import { createRoom, createTower, placeRoom } from './tower';

describe('tickManaSprings', () => {
  it('regenerates mana when water-connected', () => {
    const state = createInitialState('spring');
    state.tower = createTower();
    // 2×2 spring at (5,0); water pipe at (4,0) and (4,1).
    state.tower = placeRoom(state.tower, createRoom('g4', getBlueprint('stem')!, { col: 4, row: 0 }));
    state.tower = placeRoom(state.tower, createRoom('w1', getBlueprint('stem')!, { col: 4, row: 1 }));
    state.tower = placeRoom(state.tower, createRoom('spring', getBlueprint('manaSpringRoom')!, { col: 5, row: 0 }));
    state.tower = placeInfra(state.tower, { col: 4, row: 0 }, 'pipe');
    state.tower = placeInfra(state.tower, { col: 4, row: 1 }, 'pipe');
    state.player.mana = 10;
    tickManaSprings(state, 1);
    expect(state.player.mana).toBeCloseTo(10 + MANA_SPRING_PER_SEC, 5);
  });

  it('does nothing without water', () => {
    const state = createInitialState('spring-dry');
    state.tower = createTower();
    state.tower = placeRoom(state.tower, createRoom('g4', getBlueprint('stem')!, { col: 4, row: 0 }));
    state.tower = placeRoom(state.tower, createRoom('spring', getBlueprint('manaSpringRoom')!, { col: 5, row: 0 }));
    state.player.mana = 10;
    tickManaSprings(state, 1);
    expect(state.player.mana).toBe(10);
  });

  it('caps at max mana', () => {
    const state = createInitialState('spring-cap');
    state.tower = createTower();
    state.tower = placeRoom(state.tower, createRoom('g4', getBlueprint('stem')!, { col: 4, row: 0 }));
    state.tower = placeRoom(state.tower, createRoom('w1', getBlueprint('stem')!, { col: 4, row: 1 }));
    state.tower = placeRoom(state.tower, createRoom('spring', getBlueprint('manaSpringRoom')!, { col: 5, row: 0 }));
    state.tower = placeInfra(state.tower, { col: 4, row: 0 }, 'pipe');
    state.player.mana = MAX_MANA - 0.1;
    tickManaSprings(state, 1);
    expect(state.player.mana).toBe(MAX_MANA);
  });
});

describe('mana spring connectivity', () => {
  it('warns when a spring lacks water', () => {
    const state = createInitialState('spring-warn');
    state.tower = createTower();
    state.tower = placeRoom(state.tower, createRoom('g4', getBlueprint('stem')!, { col: 4, row: 0 }));
    state.tower = placeRoom(state.tower, createRoom('spring', getBlueprint('manaSpringRoom')!, { col: 5, row: 0 }));
    const report = selectPipeConnectivityReport(state);
    expect(report.rooms.some((r) => r.roomId === 'spring' && r.warning.includes('water'))).toBe(true);
  });
});
