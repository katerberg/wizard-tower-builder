import { describe, expect, it } from 'vitest';
import { BOILER_MANA_PER_SEC } from '@/config/constants';
import { getBlueprint } from './blueprints';
import { placeInfra } from './infra';
import { resetBoilerRuntime, tickBoilers } from './boilers';
import { selectPipeConnectivityReport } from './pipes';
import { createInitialState } from './game';
import { createRoom, createTower, placeRoom } from './tower';

function boilerWithPorts() {
  const state = createInitialState('boiler0');
  state.tower = createTower();
  // Water column at col 4; boiler 1×2 at (5,0) covering (5,0)–(5,1); steam outlet at (6,1).
  state.tower = placeRoom(state.tower, createRoom('g4', getBlueprint('stem')!, { col: 4, row: 0 }));
  state.tower = placeRoom(state.tower, createRoom('w1', getBlueprint('stem')!, { col: 4, row: 1 }));
  state.tower = placeRoom(state.tower, createRoom('boiler', getBlueprint('boilerRoom')!, { col: 5, row: 0 }));
  state.tower = placeRoom(state.tower, createRoom('s0', getBlueprint('stem')!, { col: 6, row: 0 }));
  state.tower = placeRoom(state.tower, createRoom('s1', getBlueprint('stem')!, { col: 6, row: 1 }));
  state.tower = placeInfra(state.tower, { col: 4, row: 0 }, 'pipe');
  state.tower = placeInfra(state.tower, { col: 4, row: 1 }, 'pipe');
  state.tower = placeInfra(state.tower, { col: 6, row: 1 }, 'pipe');
  state.phase = 'attack';
  resetBoilerRuntime(state);
  return state;
}

describe('tickBoilers', () => {
  it('drains mana and marks steam available when both ports are connected', () => {
    const state = boilerWithPorts();
    const before = state.player.mana;
    tickBoilers(state, 1);
    expect(state.player.mana).toBeCloseTo(before - BOILER_MANA_PER_SEC, 5);
    expect(state.boilerRuntime.boiler?.producing).toBe(true);
    expect(state.boilerRuntime.boiler?.steamAvailable).toBe(true);
  });

  it('stops producing when mana is empty', () => {
    const state = boilerWithPorts();
    state.player.mana = 0;
    tickBoilers(state, 1);
    expect(state.boilerRuntime.boiler?.producing).toBe(false);
    expect(state.boilerRuntime.boiler?.steamAvailable).toBe(false);
  });

  it('does not produce without a steam outlet', () => {
    const state = createInitialState('boiler-dry');
    state.tower = createTower();
    state.tower = placeRoom(state.tower, createRoom('g4', getBlueprint('stem')!, { col: 4, row: 0 }));
    state.tower = placeRoom(state.tower, createRoom('w1', getBlueprint('stem')!, { col: 4, row: 1 }));
    state.tower = placeRoom(state.tower, createRoom('boiler', getBlueprint('boilerRoom')!, { col: 5, row: 0 }));
    state.tower = placeInfra(state.tower, { col: 4, row: 0 }, 'pipe');
    state.tower = placeInfra(state.tower, { col: 4, row: 1 }, 'pipe');
    state.phase = 'attack';
    resetBoilerRuntime(state);
    const before = state.player.mana;
    tickBoilers(state, 1);
    expect(state.player.mana).toBe(before);
    expect(state.boilerRuntime.boiler?.producing).toBe(false);
  });
});

describe('selectPipeConnectivityReport', () => {
  it('warns when a boiler lacks water', () => {
    const state = createInitialState('pipe-warn');
    state.tower = createTower();
    state.tower = placeRoom(state.tower, createRoom('g5', getBlueprint('stem')!, { col: 4, row: 0 }));
    state.tower = placeRoom(state.tower, createRoom('boiler', getBlueprint('boilerRoom')!, { col: 5, row: 0 }));
    const report = selectPipeConnectivityReport(state);
    expect(report.boilers.some((b) => b.roomId === 'boiler' && b.warning.includes('water'))).toBe(true);
  });
});
