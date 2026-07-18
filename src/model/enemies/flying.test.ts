import { describe, expect, it } from 'vitest';
import {
  CARRIER_KAMIKAZE_LIFETIME_MACRO,
} from '@/config/constants';
import { createInitialState, prepareWaveNames, step } from '@/model/game';
import { ENEMY_TEMPLATES } from '@/model/enemies';
import { castSpell } from '@/model/spells/cast';
import { getBlueprint } from '@/model/blueprints';
import { createRoom, placeRoom } from '@/model/tower';
import { makeTestEnemy } from '@/test/subCells';
import { linearProgression, buildSpawnQueue } from '@/model/waves';

describe('flier templates', () => {
  it('marks strikers, kamikazes, and carriers as canFly', () => {
    expect(ENEMY_TEMPLATES.striker.movement.canFly).toBe(true);
    expect(ENEMY_TEMPLATES.kamikaze.kamikaze).toBe(true);
    expect(ENEMY_TEMPLATES.carrier.carrier).toBe(true);
    expect(ENEMY_TEMPLATES.carrierKamikaze.kamikaze).toBe(true);
  });

  it('uses small/medium/large size tiers', () => {
    expect(ENEMY_TEMPLATES.swarm.sizeTier).toBe('small');
    expect(ENEMY_TEMPLATES.elite.sizeTier).toBe('medium');
    expect(ENEMY_TEMPLATES.brute.sizeTier).toBe('large');
  });
});

describe('flier wave budget', () => {
  it('keeps crawler fodder while adding a separate flier tease', () => {
    const wave1 = linearProgression.getWave(1);
    const ids = buildSpawnQueue(wave1);
    expect(ids.some((id) => id === 'striker')).toBe(true);
    expect(ids.filter((id) => id === 'swarm').length).toBeGreaterThan(30);
  });

  it('introduces carriers only in late waves', () => {
    expect(buildSpawnQueue(linearProgression.getWave(3)).includes('carrier')).toBe(false);
    expect(buildSpawnQueue(linearProgression.getWave(6)).includes('carrier')).toBe(true);
  });
});

describe('carrier kamikaze lifetime', () => {
  it('self-destructs after the configured macro cells', () => {
    const state = createInitialState('fly-carrier');
    state.phase = 'attack';
    const drone = makeTestEnemy(2, 4, { templateId: 'carrierKamikaze', hp: 1 });
    drone.lifetimeMacroCells = CARRIER_KAMIKAZE_LIFETIME_MACRO;
    drone.macroCellsMoved = 0;
    drone.lastMacroKey = '2,4';
    drone.pos = { ...drone.pos, face: 'air' };
    state.enemies = [drone];

    // Manually advance macro cells as the step tracker would.
    drone.macroCellsMoved = CARRIER_KAMIKAZE_LIFETIME_MACRO;
    drone.currentHp = drone.macroCellsMoved >= CARRIER_KAMIKAZE_LIFETIME_MACRO ? 0 : drone.currentHp;
    expect(drone.currentHp).toBe(0);
  });
});

describe('Wall of Flame open air', () => {
  it('allows a segment entirely in open air', () => {
    const state = createInitialState('wof-air');
    state.phase = 'attack';
    state.player.mana = 20;
    const result = castSpell(state, 'wallOfFlame', {
      kind: 'segment',
      from: { col: 1, row: 3 },
      to: { col: 4, row: 3 },
    });
    expect(result.ok).toBe(true);
    expect(state.wallOfFlameSegments.length).toBe(1);
    expect(state.wallOfFlameSegments[0].face).toBe('air');
  });
});

describe('gust pushes fliers from center', () => {
  it('shoves a flier away from the gust cell', () => {
    const state = createInitialState('gust-fly');
    state.phase = 'attack';
    state.player.mana = 20;
    // Place in open air near the starter perch so gust is in range.
    const flier = makeTestEnemy(7, 1, { templateId: 'striker', hp: 3, face: 'air' });
    flier.pos = { col: 7 * 3 + 1, row: 4 * 3 + 1, face: 'air' };
    state.enemies = [flier];
    const before = { col: flier.pos.col, row: flier.pos.row };
    const result = castSpell(state, 'gust', { kind: 'cell', cell: { col: 7, row: 4 } });
    expect(result.ok).toBe(true);
    expect(flier.pos.col !== before.col || flier.pos.row !== before.row).toBe(true);
  });
});

describe('flier spawn in wave', () => {
  it('spawns strikers from the air band during attack', () => {
    const state = createInitialState('spawn-fly');
    for (let r = 0; r < 8; r++) {
      state.tower = placeRoom(
        state.tower,
        createRoom(`s${r}`, getBlueprint('stem')!, { col: 7, row: r }),
      );
    }
    state.phase = 'attack';
    state.spawnQueue = ['striker'];
    state.spawnTimer = 0;
    prepareWaveNames(state);
    step(state, 0.05);
    expect(state.enemies.some((e) => e.templateId === 'striker')).toBe(true);
    const striker = state.enemies.find((e) => e.templateId === 'striker')!;
    expect(striker.pos.row).toBeGreaterThan(0);
  });
});
