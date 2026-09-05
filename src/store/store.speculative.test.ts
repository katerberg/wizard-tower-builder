import { describe, expect, it } from 'vitest';
import { FIXED_DT } from '@/config/constants';
import { getInfraAt } from '@/model/infra';
import { shellKindAt } from '@/model/fortifications/shell';
import { hasStructure } from '@/model/tower';
import type { Cell } from '@/model/types';
import { selectGhostPlacement } from '@/store/selectors';
import { Store } from '@/store/store';

/** Legal extension column east of starter quarters (col 9). */
const EXT_COL = 10;

function paint(store: Store, blueprintId: string, cell: Cell): void {
  store.dispatch({ type: 'selectBlueprint', blueprintId });
  store.dispatch({ type: 'placeSelectedAt', cell });
}

function hover(store: Store, blueprintId: string, cell: Cell): void {
  store.dispatch({ type: 'selectBlueprint', blueprintId });
  store.dispatch({ type: 'hoverCell', cell });
}

describe('speculative paint ghost', () => {
  it('marks a live-illegal but planned-legal cell as valid', () => {
    const store = new Store('ghost-planned');
    hover(store, 'quartersRoom', { col: EXT_COL, row: 1 });
    const blocked = selectGhostPlacement(store.getSnapshot());
    expect(blocked?.valid).toBe(false);
    expect(blocked?.needsPlannedSupport).toBe(false);

    paint(store, 'stem', { col: EXT_COL, row: 0 });
    hover(store, 'quartersRoom', { col: EXT_COL, row: 1 });

    const ghost = selectGhostPlacement(store.getSnapshot());
    expect(ghost?.valid).toBe(true);
    expect(ghost?.needsPlannedSupport).toBe(true);
    expect(ghost?.reason).toBe('ok');
  });

  it('keeps truly illegal cells invalid', () => {
    const store = new Store('ghost-illegal');
    hover(store, 'stem', { col: EXT_COL, row: 3 });

    const ghost = selectGhostPlacement(store.getSnapshot());
    expect(ghost?.valid).toBe(false);
    expect(ghost?.needsPlannedSupport).toBe(false);
  });
});

describe('infra and fortification paint', () => {
  it('queues a pipe order instead of placing it', () => {
    const store = new Store('paint-pipe');
    paint(store, 'pipe', { col: EXT_COL, row: 0 });

    const { game } = store.getSnapshot();
    expect(game.constructionOrders.map((o) => o.blueprintId)).toEqual(['pipe']);
    expect(getInfraAt(game.tower, EXT_COL, 0)).toBeUndefined();
  });

  it('queues a fortification order instead of placing it', () => {
    const store = new Store('paint-moat');
    paint(store, 'moat', { col: 4, row: 0 });

    const { game } = store.getSnapshot();
    expect(game.constructionOrders.map((o) => o.blueprintId)).toEqual(['moat']);
    expect(shellKindAt(game.tower, 4, 0)).toBeUndefined();
  });
});

describe('dependency-aware labor', () => {
  it('builds the bottom of a planned column first', () => {
    const store = new Store('labor-bottom-up');
    paint(store, 'stem', { col: EXT_COL, row: 0 });
    paint(store, 'stem', { col: EXT_COL, row: 1 });
    expect(store.getSnapshot().game.constructionOrders).toHaveLength(2);

    store.getSnapshot().game.phasePaused = true;
    for (let i = 0; i < 60 * 120; i += 1) {
      store.advance(FIXED_DT);
      if (store.getSnapshot().game.constructionOrders.length < 2) break;
    }

    const { game } = store.getSnapshot();
    expect(game.constructionOrders).toHaveLength(1);
    expect(hasStructure(game.tower, EXT_COL, 0)).toBe(true);
    expect(hasStructure(game.tower, EXT_COL, 1)).toBe(false);
  });
});
