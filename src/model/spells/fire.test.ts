import { describe, expect, it } from 'vitest';
import { getBlueprint } from '@/model/blueprints';
import { createInitialState } from '@/model/game';
import { beginWave } from '@/model/phases';
import {
  addKindlingPatch,
  applyFireDamage,
  applyKindled,
  buildSpellContext,
  castSpell,
  gridLine,
  isKindled,
  isOnWall,
  isValidKindlingPlacement,
  onEnemyWallStep,
  runKindlingPatchStepEffects,
  sameFaceEndpoints,
  startImmolate,
  tickFireEffects,
} from '@/model/spells';
import { createRoom, createTower, placeRoom } from '@/model/tower';
import type { Enemy, GameState } from '@/model/types';
import { KINDLED_BURST, KINDLED_DURATION } from '@/model/spells/fire/constants';

function towerWithStem(state: GameState): GameState {
  const stem = getBlueprint('stem')!;
  state.tower = placeRoom(createTower(), createRoom('r0', stem, { col: 8, row: 0 }));
  return state;
}

function makeEnemy(col: number, row: number, hp = 40): Enemy {
  return {
    id: `e-${col}-${row}`,
    templateId: 'brute',
    name: 'Test',
    pos: { col, row, face: 'left' },
    path: [],
    pathIndex: 0,
    currentHp: hp,
    moveCooldown: 0,
    attackCooldown: 0,
  };
}

describe('Kindled', () => {
  it('procs flat burst after normal fire damage and consumes the mark', () => {
    const state = towerWithStem(createInitialState('kindled0'));
    state.phase = 'attack';
    const enemy = makeEnemy(8, 1);
    applyKindled(state, enemy);
    state.enemies = [enemy];

    const ctx = buildSpellContext(state, 'Fireball');
    applyFireDamage(ctx, enemy, 10);
    expect(enemy.currentHp).toBe(40 - 10 - KINDLED_BURST);
    expect(isKindled(enemy, state)).toBe(false);
  });

  it('refreshes Kindled timer when stepping a patch again', () => {
    const state = towerWithStem(createInitialState('kindled1'));
    state.phase = 'attack';
    state.waveTimer = 5;
    const enemy = makeEnemy(8, 1);
    applyKindled(state, enemy);
    const firstExpiry = enemy.kindledUntil;
    state.waveTimer = 10;
    addKindlingPatch(state, { col: 8, row: 1 });
    runKindlingPatchStepEffects(state, enemy);
    expect(enemy.kindledUntil).toBeGreaterThan(firstExpiry!);
    expect(enemy.kindledUntil).toBe(10 + KINDLED_DURATION);
  });
});

describe('Kindling patch', () => {
  it('marks enemies that step on the trap', () => {
    const state = towerWithStem(createInitialState('patch0'));
    state.phase = 'attack';
    addKindlingPatch(state, { col: 8, row: 1 });
    const enemy = makeEnemy(8, 1);
    runKindlingPatchStepEffects(state, enemy);
    expect(isKindled(enemy, state)).toBe(true);
  });

  it('allows placement on exterior cells beside the tower', () => {
    const state = towerWithStem(createInitialState('patch1'));
    expect(isValidKindlingPlacement(state.tower, { col: 8, row: 1 })).toBe(true);
    expect(isValidKindlingPlacement(state.tower, { col: 12, row: 4 })).toBe(false);
  });
});

describe('Immolate', () => {
  it('ticks fire damage while the enemy stays on a wall', () => {
    const state = towerWithStem(createInitialState('imm0'));
    state.phase = 'attack';
    const enemy = makeEnemy(8, 1);
    state.enemies = [enemy];
    startImmolate(state, enemy);
    expect(isOnWall(state.tower, enemy)).toBe(true);

    tickFireEffects(state, 0.6, (name) => buildSpellContext(state, name));
    expect(enemy.currentHp).toBeLessThan(40);
  });

  it('ends when the enemy leaves the wall surface', () => {
    const state = towerWithStem(createInitialState('imm1'));
    state.phase = 'attack';
    const enemy = makeEnemy(8, 1);
    startImmolate(state, enemy);
    enemy.pos = { col: 12, row: 4, face: 'top' };
    onEnemyWallStep(state, enemy);
    expect(enemy.immolateUntil).toBeUndefined();
  });
});

describe('Wall of Flame', () => {
  it('builds a straight grid line up to 5 cells', () => {
    const line = gridLine({ col: 8, row: 1 }, { col: 8, row: 5 });
    expect(line).not.toBeNull();
    expect(line!.length).toBe(5);
  });

  it('rejects segments longer than 5 cells', () => {
    expect(gridLine({ col: 8, row: 0 }, { col: 8, row: 6 })).toBeNull();
  });

  it('requires same-face endpoints', () => {
    const state = towerWithStem(createInitialState('wall0'));
    expect(sameFaceEndpoints(state.tower, { col: 7, row: 1 }, { col: 9, row: 1 })).toBe(true);
  });

  it('creates a timed segment on cast', () => {
    const state = towerWithStem(createInitialState('wall1'));
    state.phase = 'attack';
    beginWave(state);
    const result = castSpell(state, 'wallOfFlame', {
      kind: 'segment',
      from: { col: 8, row: 1 },
      to: { col: 8, row: 3 },
    });
    expect(result.ok).toBe(true);
    expect(state.wallOfFlameSegments.length).toBe(1);
    expect(state.wallOfFlameSegments[0].cells.length).toBe(3);
  });
});

describe('fire hotbar kit', () => {
  it('casts kindling on a valid adjacent cell', () => {
    const state = towerWithStem(createInitialState('kit0'));
    state.phase = 'attack';
    const result = castSpell(state, 'kindling', { kind: 'cell', cell: { col: 8, row: 1 } });
    expect(result.ok).toBe(true);
    expect(state.kindlingPatches.length).toBe(1);
  });

  it('casts immolate on a clicked enemy', () => {
    const state = towerWithStem(createInitialState('kit1'));
    state.phase = 'attack';
    const enemy = makeEnemy(8, 1);
    state.enemies = [enemy];
    const result = castSpell(state, 'immolate', { kind: 'enemy', enemyId: enemy.id });
    expect(result.ok).toBe(true);
    expect(enemy.immolateUntil).toBeDefined();
  });
});
