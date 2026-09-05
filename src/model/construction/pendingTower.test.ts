import { describe, expect, it } from 'vitest';
import { getBlueprint } from '@/model/blueprints';
import { createInitialState } from '@/model/game';
import { shellKindAt } from '@/model/fortifications/shell';
import { getInfraAt } from '@/model/infra';
import { validateLeylineRoomPlacement } from '@/model/spells/progression';
import { emptyStockpile } from '@/model/storage';
import { canPlace, hasStructure } from '@/model/tower';
import type { Cell, ConstructionOrder, GameState } from '@/model/types';
import {
  cancelConstructionOrder,
  completeConstructionOrder,
  createBuildOrder,
  freezeIncompleteOrdersAtDusk,
  resetConstructionCounter,
} from './orders';
import { liveLegalBuildOrderIds, towerWithPendingOrders } from './pendingTower';

/** Legal extension column east of starter quarters (col 9). */
const EXT_COL = 10;

function newState(seed: string): GameState {
  resetConstructionCounter();
  return createInitialState(seed);
}

let paintCounter = 0;

function paint(state: GameState, blueprintId: string, origin: Cell): ConstructionOrder | null {
  return createBuildOrder(state, blueprintId, origin, () => `paint-${paintCounter++}`);
}

function plannedOrder(id: string, blueprintId: string, origin: Cell): ConstructionOrder {
  return {
    id,
    kind: 'build',
    blueprintId,
    origin,
    status: 'planned',
    deliverRemaining: emptyStockpile(),
    onSiteMaterials: emptyStockpile(),
    buildProgress: 0,
    buildWorkRequired: 1,
    soulsReserved: 0,
    invalid: false,
  };
}

describe('towerWithPendingOrders', () => {
  it('applies pending orders bottom-up regardless of queue order', () => {
    const state = newState('virtual-bottom-up');
    const orders = [
      plannedOrder('o-top', 'stem', { col: EXT_COL, row: 1 }),
      plannedOrder('o-bottom', 'stem', { col: EXT_COL, row: 0 }),
    ];

    const planned = towerWithPendingOrders(state.tower, orders);

    expect(hasStructure(planned, EXT_COL, 0)).toBe(true);
    expect(hasStructure(planned, EXT_COL, 1)).toBe(true);
    expect(hasStructure(state.tower, EXT_COL, 0)).toBe(false);
  });

  it('skips orders marked invalid', () => {
    const state = newState('virtual-invalid');
    const order = plannedOrder('o-bottom', 'stem', { col: EXT_COL, row: 0 });
    order.invalid = true;

    expect(hasStructure(towerWithPendingOrders(state.tower, [order]), EXT_COL, 0)).toBe(false);
  });
});

describe('speculative paint', () => {
  it('queues a room whose support is only planned', () => {
    const state = newState('spec-room');
    const quarters = getBlueprint('quartersRoom')!;
    expect(canPlace(state.tower, quarters, { col: EXT_COL, row: 1 }).ok).toBe(false);

    const lower = paint(state, 'stem', { col: EXT_COL, row: 0 });
    const upper = paint(state, 'quartersRoom', { col: EXT_COL, row: 1 });

    expect(lower).not.toBeNull();
    expect(upper).not.toBeNull();
    expect(upper?.invalid).toBe(false);
    expect(state.constructionOrders).toHaveLength(2);
  });

  it('lets laborers work only the live-legal bottom of a planned column', () => {
    const state = newState('spec-column');
    const lower = paint(state, 'stem', { col: EXT_COL, row: 0 });
    const upper = paint(state, 'stem', { col: EXT_COL, row: 1 });

    const buildable = liveLegalBuildOrderIds(state);

    expect(buildable.has(lower!.id)).toBe(true);
    expect(buildable.has(upper!.id)).toBe(false);
  });

  it('rejects framing that floats even on the planned tower', () => {
    const state = newState('spec-floating');
    expect(paint(state, 'stem', { col: EXT_COL, row: 2 })).toBeNull();
    expect(state.constructionOrders).toHaveLength(0);
  });

  it('queues a turret on top of a planned spire stack', () => {
    const state = newState('spec-turret');
    paint(state, 'stem', { col: EXT_COL, row: 0 });
    paint(state, 'stem', { col: EXT_COL, row: 1 });

    const turret = paint(state, 'turretRoom', { col: EXT_COL, row: 2 });

    expect(turret).not.toBeNull();
    expect(state.constructionOrders).toHaveLength(3);
  });

  it('honours research gates when validating a paint', () => {
    const state = newState('spec-overhang');
    // Bridges the gap between the twin starter crowns — legal only with Cantilever Framing.
    const cantilever = { col: 7, row: 2 };

    expect(paint(state, 'stem', cantilever)).toBeNull();
    expect(
      createBuildOrder(state, 'stem', cantilever, () => 'overhang-stem', { overhangUnlocked: true }),
    ).not.toBeNull();
  });

  it('replaces plans it paints over', () => {
    const state = newState('spec-overlap');
    const first = paint(state, 'stem', { col: EXT_COL, row: 0 });
    const second = paint(state, 'quartersRoom', { col: EXT_COL, row: 0 });

    expect(second).not.toBeNull();
    expect(state.constructionOrders).toHaveLength(1);
    expect(state.constructionOrders[0].blueprintId).toBe('quartersRoom');
    expect(state.storageReservations.some((r) => r.orderId === first!.id)).toBe(false);
  });

  it('rejects repainting the same blueprint onto its own plan', () => {
    const state = newState('spec-duplicate');
    paint(state, 'stem', { col: EXT_COL, row: 0 });

    expect(paint(state, 'stem', { col: EXT_COL, row: 0 })).toBeNull();
    expect(state.constructionOrders).toHaveLength(1);
  });
});

describe('orphaned plans', () => {
  it('marks dependents invalid on cancel and keeps their reservation', () => {
    const state = newState('spec-cancel');
    const lower = paint(state, 'stem', { col: EXT_COL, row: 0 });
    const upper = paint(state, 'quartersRoom', { col: EXT_COL, row: 1 });

    cancelConstructionOrder(state, lower!.id);

    expect(upper?.invalid).toBe(true);
    expect(state.constructionOrders).toHaveLength(1);
    expect(state.storageReservations.some((r) => r.orderId === upper!.id)).toBe(true);
    expect(liveLegalBuildOrderIds(state).size).toBe(0);
  });

  it('revives dependents when their support is painted again', () => {
    const state = newState('spec-revive');
    const lower = paint(state, 'stem', { col: EXT_COL, row: 0 });
    const upper = paint(state, 'stem', { col: EXT_COL, row: 1 });
    cancelConstructionOrder(state, lower!.id);
    expect(upper?.invalid).toBe(true);

    paint(state, 'stem', { col: EXT_COL, row: 0 });

    expect(upper?.invalid).toBe(false);
  });
});

describe('infra and fortification orders', () => {
  it('queues a pipe instead of mutating the tower', () => {
    const state = newState('spec-pipe');
    const before = state.tower;

    const order = paint(state, 'pipe', { col: EXT_COL, row: 0 });

    expect(order?.blueprintId).toBe('pipe');
    expect(state.tower).toBe(before);
    expect(getInfraAt(state.tower, EXT_COL, 0)).toBeUndefined();

    completeConstructionOrder(state, order!, () => 'built-pipe');

    expect(getInfraAt(state.tower, EXT_COL, 0)?.kind).toBe('pipe');
    expect(hasStructure(state.tower, EXT_COL, 0)).toBe(true);
  });

  it('queues a fortification instead of mutating the shell', () => {
    const state = newState('spec-moat');
    const order = paint(state, 'moat', { col: 4, row: 0 });

    expect(order?.blueprintId).toBe('moat');
    expect(shellKindAt(state.tower, 4, 0)).toBeUndefined();

    completeConstructionOrder(state, order!, () => 'built-moat');

    expect(shellKindAt(state.tower, 4, 0)).toBe('moat');
  });
});

describe('dusk freeze', () => {
  it('scaffolds an order the laborers could finish', () => {
    const state = newState('dusk-legal');
    const order = paint(state, 'stem', { col: EXT_COL, row: 0 })!;
    order.status = 'delivering';
    order.onSiteMaterials = { stone: 3, metal: 0 };

    freezeIncompleteOrdersAtDusk(state);

    expect(order.status).toBe('scaffold');
    expect(hasStructure(state.tower, EXT_COL, 0)).toBe(true);
  });

  it('leaves an orphaned plan unfrozen', () => {
    const state = newState('dusk-orphan');
    const lower = paint(state, 'stem', { col: EXT_COL, row: 0 });
    const upper = paint(state, 'stem', { col: EXT_COL, row: 1 })!;
    upper.status = 'delivering';
    upper.onSiteMaterials = { stone: 3, metal: 0 };
    cancelConstructionOrder(state, lower!.id);

    freezeIncompleteOrdersAtDusk(state);

    expect(upper.status).toBe('delivering');
    expect(hasStructure(state.tower, EXT_COL, 1)).toBe(false);
  });
});

describe('leyline bands', () => {
  it('lets a pending plan hold its band', () => {
    const state = newState('spec-leyline');
    state.constructionOrders.push(
      plannedOrder('leyline-plan', 'leylineResearchRoom', { col: 5, row: 25 }),
    );

    const taken = validateLeylineRoomPlacement(
      state,
      'leylineResearchRoom',
      { col: 8, row: 25 },
      { w: 2, h: 1 },
    );
    expect(taken?.reason).toBe('leyline_band_taken');

    const rebuild = validateLeylineRoomPlacement(
      state,
      'leylineResearchRoom',
      { col: 5, row: 25 },
      { w: 2, h: 1 },
    );
    expect(rebuild?.ok).toBe(true);
  });
});
