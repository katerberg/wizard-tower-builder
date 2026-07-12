import { describe, expect, it } from 'vitest';
import { BOILER_MANA_PER_SEC, BOILER_THROUGHPUT, STEAM_TURRET_CHARGE_SEC } from '@/config/constants';
import { getBlueprint } from './blueprints';
import { placeInfra } from './infra';
import { resetBoilerRuntime, tickBoilers } from './boilers';
import { selectPipeConnectivityReport } from './pipes';
import { createInitialState } from './game';
import { resetSteamTurretRuntime, steamTurretBlastCells, tickSteamTurrets } from './steamTurrets';
import { createRoom, createTower, placeRoom } from './tower';
import { makeTestEnemy } from '@/test/subCells';

/** Water → boiler → steam pipe → steam turret. */
function boilerSteamNetwork() {
  const state = createInitialState('boiler0');
  state.tower = createTower();
  state.tower = placeRoom(state.tower, createRoom('g4', getBlueprint('stem')!, { col: 4, row: 0 }));
  state.tower = placeRoom(state.tower, createRoom('w1', getBlueprint('stem')!, { col: 4, row: 1 }));
  state.tower = placeRoom(state.tower, createRoom('boiler', getBlueprint('boilerRoom')!, { col: 5, row: 0 }));
  state.tower = placeRoom(state.tower, createRoom('s0', getBlueprint('stem')!, { col: 6, row: 0 }));
  state.tower = placeRoom(state.tower, createRoom('s1', getBlueprint('stem')!, { col: 6, row: 1 }));
  state.tower = placeRoom(state.tower, createRoom('turret', getBlueprint('steamTurretRoom')!, { col: 7, row: 1 }));
  state.tower = placeRoom(state.tower, createRoom('g7', getBlueprint('stem')!, { col: 7, row: 0 }));
  state.tower = placeInfra(state.tower, { col: 4, row: 0 }, 'pipe');
  state.tower = placeInfra(state.tower, { col: 4, row: 1 }, 'pipe');
  state.tower = placeInfra(state.tower, { col: 6, row: 1 }, 'pipe');
  state.phase = 'attack';
  resetBoilerRuntime(state);
  resetSteamTurretRuntime(state);
  return state;
}

describe('tickBoilers', () => {
  it('drains mana and marks steam available when both ports are connected', () => {
    const state = boilerSteamNetwork();
    const before = state.player.mana;
    tickBoilers(state, 1);
    expect(state.player.mana).toBeCloseTo(before - BOILER_MANA_PER_SEC, 5);
    expect(state.boilerRuntime.boiler?.producing).toBe(true);
    expect(state.boilerRuntime.boiler?.steamAvailable).toBe(true);
  });

  it('stops producing when mana is empty', () => {
    const state = boilerSteamNetwork();
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

describe('tickSteamTurrets', () => {
  it('charges from boiler throughput and fires a blast dump', () => {
    const state = boilerSteamNetwork();
    tickBoilers(state, 0.1);
    // Base throughput 3 → chargeRate 3; full charge in STEAM_TURRET_CHARGE_SEC / 3.
    const fullDt = STEAM_TURRET_CHARGE_SEC / BOILER_THROUGHPUT[0] + 0.01;
    tickSteamTurrets(state, fullDt * 0.5);
    expect(state.steamTurretRuntime.turret.charge).toBeGreaterThan(0);
    expect(state.steamTurretRuntime.turret.charge).toBeLessThan(1);
    expect(state.steamTurretRuntime.turret.chargeRate).toBe(BOILER_THROUGHPUT[0]);

    const partial = state.steamTurretRuntime.turret.charge;
    // Retain partial when steam stops.
    state.boilerRuntime.boiler = { producing: false, steamAvailable: false };
    tickSteamTurrets(state, 1);
    expect(state.steamTurretRuntime.turret.charge).toBeCloseTo(partial, 5);
    expect(state.steamTurretRuntime.turret.chargeRate).toBe(0);

    // Restore steam and finish charge with an enemy in the right-side blast.
    state.boilerRuntime.boiler = { producing: true, steamAvailable: true };
    state.enemies = [makeTestEnemy(8, 1, { templateId: 'elite', hp: 28 })];
    tickSteamTurrets(state, fullDt);
    expect(state.enemies[0].currentHp).toBeLessThan(28);
    expect(state.steamTurretRuntime.turret.charge).toBe(0);
  });

  it('includes both open side lanes in the blast', () => {
    const state = boilerSteamNetwork();
    const blast = steamTurretBlastCells(state.tower, { col: 7, row: 1 });
    expect(blast.some((c) => c.col === 8 && c.row === 1)).toBe(true);
    expect(blast.some((c) => c.col === 6 && c.row === 1)).toBe(false); // occupied by stem
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

  it('warns when a steam turret lacks a steam pipe', () => {
    const state = createInitialState('turret-warn');
    state.tower = createTower();
    state.tower = placeRoom(state.tower, createRoom('g5', getBlueprint('stem')!, { col: 5, row: 0 }));
    state.tower = placeRoom(state.tower, createRoom('turret', getBlueprint('steamTurretRoom')!, { col: 5, row: 1 }));
    const report = selectPipeConnectivityReport(state);
    expect(report.rooms.some((r) => r.roomId === 'turret' && r.warning.includes('steam pipe'))).toBe(
      true,
    );
  });
});
