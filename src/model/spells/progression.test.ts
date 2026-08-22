import { describe, expect, it } from 'vitest';
import { getBlueprint } from '@/model/blueprints';
import { createInitialState } from '@/model/game';
import { endWave } from '@/model/phases';
import {
  activeHotbarSpellIds,
  canCastSpell,
  isLeylineTierCompleted,
  isSpellUnlocked,
  pickSpellSchoolForRun,
  starterSpellId,
  validateLeylineRoomPlacement,
} from '@/model/spells';
import { leylineResearchRoom } from '@/model/rooms/leylineResearch';
import { createRoom, createStructure, placeRoom, placeStructure } from '@/model/tower';
import type { GameState, Room } from '@/model/types';

function placeLeyline(state: GameState, origin: { col: number; row: number }, id = 'leyline-1'): Room {
  const bp = getBlueprint('leylineResearchRoom')!;
  const stem = getBlueprint('stem')!;
  let tower = state.tower;
  for (const cell of [
    { col: origin.col, row: origin.row },
    { col: origin.col + 1, row: origin.row },
  ]) {
    if (!tower.structureOccupancy[`${cell.col},${cell.row}`]) {
      tower = placeStructure(tower, createStructure(`stem-${cell.col}-${cell.row}`, stem, cell));
    }
  }
  const room = createRoom(id, bp, origin);
  tower = placeRoom(tower, room);
  state.tower = tower;
  state.leylineResearchAllocations[id] = 1;
  return room;
}

function stationMage(state: GameState, roomId: string): void {
  state.staff.push({
    id: 'mage-1',
    kind: 'mage',
    homeHousingId: 'chamber',
    targetWorkplaceId: roomId,
    pos: { col: 8, row: 25 },
    path: [],
    pathIndex: 0,
    moveCooldown: 0,
    status: 'stationed',
  });
}

describe('spell school pick', () => {
  it('is deterministic for the same seed', () => {
    expect(pickSpellSchoolForRun('leyline-a')).toBe(pickSpellSchoolForRun('leyline-a'));
    expect(createInitialState('leyline-a').activeSpellSchool).toBe(pickSpellSchoolForRun('leyline-a'));
  });

  it('can differ across seeds', () => {
    const schools = new Set(
      ['seed-a', 'seed-b', 'seed-c', 'seed-d', 'seed-e', 'seed-f', 'seed-g', 'seed-h'].map(
        (s) => pickSpellSchoolForRun(s),
      ),
    );
    expect(schools.size).toBeGreaterThan(1);
  });
});

describe('hotbar gating', () => {
  it('non-dev starts with only the starter spell', () => {
    const state = createInitialState('gate0');
    expect(state.devMode).toBe(false);
    const ids = activeHotbarSpellIds(state);
    expect(ids[0]).toBe(starterSpellId(state));
    expect(ids[1]).toBeNull();
    expect(ids[2]).toBeNull();
    expect(ids[3]).toBeNull();
    expect(canCastSpell(state, starterSpellId(state)).ok).toBe(false); // day phase
    state.phase = 'night';
    expect(isSpellUnlocked(state, starterSpellId(state))).toBe(true);
    const secondId = activeHotbarSpellIds({ ...state, devMode: true })[1];
    if (secondId) {
      const locked = canCastSpell(state, secondId);
      expect(locked.ok).toBe(false);
      if (!locked.ok) expect(locked.reason).toBe('locked');
    }
  });

  it('dev mode unlocks the full school kit', () => {
    const state = createInitialState('devkit');
    state.devMode = true;
    state.phase = 'night';
    const ids = activeHotbarSpellIds(state);
    expect(ids.every((id) => id != null)).toBe(true);
    expect(ids).toHaveLength(4);
  });
});

describe('leyline placement', () => {
  it('rejects off-band placement', () => {
    const state = createInitialState('place0');
    const result = validateLeylineRoomPlacement(state, 'leylineResearchRoom', { col: 5, row: 10 }, { w: 2, h: 1 });
    expect(result?.ok).toBe(false);
    expect(result?.reason).toBe('leyline_band_required');
  });

  it('rejects duplicate band and tier lock', () => {
    const state = createInitialState('place1');
    placeLeyline(state, { col: 5, row: 25 }, 'a');
    const taken = validateLeylineRoomPlacement(state, 'leylineResearchRoom', { col: 8, row: 25 }, { w: 2, h: 1 });
    expect(taken?.reason).toBe('leyline_band_taken');

    const locked = validateLeylineRoomPlacement(state, 'leylineResearchRoom', { col: 5, row: 50 }, { w: 2, h: 1 });
    expect(locked?.reason).toBe('leyline_tier_locked');
  });

  it('allows band 25 when blueprint rules otherwise pass', () => {
    const state = createInitialState('place2');
    const ok = validateLeylineRoomPlacement(state, 'leylineResearchRoom', { col: 5, row: 25 }, { w: 2, h: 1 });
    expect(ok).toEqual({ ok: true, reason: 'ok' });
  });
});

describe('leyline ritual', () => {
  it('completes tier 2 when a mage is stationed at wave clear', () => {
    const state = createInitialState('ritual0');
    state.phase = 'night';
    const room = placeLeyline(state, { col: 5, row: 25 });
    stationMage(state, room.id);
    // Put mage in footprint
    state.staff[0].pos = { col: room.origin.col, row: room.origin.row };
    leylineResearchRoom.onWaveCleared!({
      state,
      room,
      cells: [
        { col: room.origin.col, row: room.origin.row },
        { col: room.origin.col + 1, row: room.origin.row },
      ],
      enemiesNear: () => [],
      enemiesTouching: () => [],
      attackEnemy: () => undefined,
      reward: () => undefined,
      log: () => undefined,
    });
    expect(isLeylineTierCompleted(state, 2)).toBe(true);
    expect(activeHotbarSpellIds(state)[1]).not.toBeNull();
  });

  it('does not complete without a stationed mage', () => {
    const state = createInitialState('ritual1');
    const room = placeLeyline(state, { col: 5, row: 25 });
    leylineResearchRoom.onWaveCleared!({
      state,
      room,
      cells: [
        { col: room.origin.col, row: room.origin.row },
        { col: room.origin.col + 1, row: room.origin.row },
      ],
      enemiesNear: () => [],
      enemiesTouching: () => [],
      attackEnemy: () => undefined,
      reward: () => undefined,
      log: () => undefined,
    });
    expect(isLeylineTierCompleted(state, 2)).toBe(false);
  });

  it('strips spell when the band room is removed, restores on rebuild', () => {
    const state = createInitialState('ritual2');
    state.leylineCompletedTiers[2] = true;
    const room = placeLeyline(state, { col: 5, row: 25 });
    expect(activeHotbarSpellIds(state)[1]).not.toBeNull();

    state.tower.rooms = state.tower.rooms.filter((r) => r.id !== room.id);
    expect(activeHotbarSpellIds(state)[1]).toBeNull();
    expect(isLeylineTierCompleted(state, 2)).toBe(true);

    placeLeyline(state, { col: 5, row: 25 }, 'leyline-2');
    expect(activeHotbarSpellIds(state)[1]).not.toBeNull();
  });

  it('ignores band-50 ritual until tier 2 is complete', () => {
    const state = createInitialState('ritual3');
    // Bypass placement lock by force-placing after marking no prior tier
    const room = placeLeyline(state, { col: 5, row: 50 });
    stationMage(state, room.id);
    state.staff[0].pos = { col: room.origin.col, row: room.origin.row };
    leylineResearchRoom.onWaveCleared!({
      state,
      room,
      cells: [
        { col: room.origin.col, row: room.origin.row },
        { col: room.origin.col + 1, row: room.origin.row },
      ],
      enemiesNear: () => [],
      enemiesTouching: () => [],
      attackEnemy: () => undefined,
      reward: () => undefined,
      log: () => undefined,
    });
    expect(isLeylineTierCompleted(state, 3)).toBe(false);
  });

  it('endWave runs the room clear hook', () => {
    const state = createInitialState('ritual4');
    state.phase = 'night';
    state.waveStartHeight = 5;
    const room = placeLeyline(state, { col: 5, row: 25 });
    stationMage(state, room.id);
    state.staff[0].pos = { col: room.origin.col, row: room.origin.row };
    state.enemies = [];
    endWave(state);
    expect(isLeylineTierCompleted(state, 2)).toBe(true);
  });
});

describe('announce at start', () => {
  it('posts a school resonance message', () => {
    const state = createInitialState('announce0');
    expect(state.messages.some((m) => m.text.includes('resonates'))).toBe(true);
  });
});
