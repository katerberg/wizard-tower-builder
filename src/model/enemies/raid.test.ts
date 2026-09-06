import { describe, expect, it } from 'vitest';
import { createInitialState } from '@/model/game';
import { beginDay, beginWave } from '@/model/phases';
import { step } from '@/model/tick';
import {
  applyCollectorDamage,
  applyHarvestRepairTax,
  afterRoomRemovedCheckStorageLose,
  breakSolarCollector,
  collectorIsBroken,
  countStorageRooms,
  pickRaidGoal,
} from '@/model/enemies/raid';
import type { Enemy } from '@/model/types';

function nightState(seed: string) {
  const state = createInitialState(seed);
  beginWave(state);
  return state;
}

describe('solar collector raid mode', () => {
  it('does not game-over when the collector breaks', () => {
    const state = nightState('raid-break');
    applyCollectorDamage(state, state.solarCollector.maxHp);
    expect(collectorIsBroken(state)).toBe(true);
    expect(state.collectorBrokeThisNight).toBe(true);
    expect(state.scene).toBe('run');
  });

  it('restores the collector at dawn and arms harvest tax', () => {
    const state = nightState('raid-dawn');
    breakSolarCollector(state);
    beginDay(state);
    expect(state.solarCollector.hp).toBe(state.solarCollector.maxHp);
    expect(state.collectorBrokeThisNight).toBe(false);
    expect(state.harvestRepairTaxActive).toBe(true);
    const taxed = applyHarvestRepairTax(10, 4, 2, true);
    expect(taxed.stone).toBe(5);
    expect(taxed.metal).toBe(2);
    expect(taxed.gold).toBe(1);
  });

  it('loses when the last storage room is destroyed', () => {
    const state = nightState('raid-storage-lose');
    const storages = state.tower.rooms.filter((r) => r.blueprintId === 'storageRoom');
    expect(storages.length).toBeGreaterThan(0);
    for (const room of [...storages]) {
      state.tower.rooms = state.tower.rooms.filter((r) => r.id !== room.id);
      afterRoomRemovedCheckStorageLose(state, room.id, 'storageRoom');
    }
    expect(countStorageRooms(state)).toBe(0);
    expect(state.scene).toBe('gameOver');
  });

  it('prefers last damage source within the vertical band for raid goals', () => {
    const state = nightState('raid-priority');
    breakSolarCollector(state);
    const storage = state.tower.rooms.find((r) => r.blueprintId === 'storageRoom');
    expect(storage).toBeTruthy();
    const enemy: Enemy = {
      id: 'e-raid',
      templateId: 'swarm',
      name: 'Raider',
      pos: {
        col: storage!.origin.col,
        row: storage!.origin.row,
        face: 'left',
      },
      path: [],
      pathIndex: 0,
      currentHp: 10,
      moveCooldown: 0,
      attackCooldown: 0,
      lastDamageSource: { roomId: storage!.id },
    };
    const goal = pickRaidGoal(state, enemy);
    expect(goal).toEqual({ kind: 'room', roomId: storage!.id });
  });

  it('keeps the run alive after a zero-HP collector step', () => {
    const state = nightState('raid-step');
    state.solarCollector.hp = 0;
    step(state, 0.1);
    expect(state.scene).toBe('run');
  });
});
