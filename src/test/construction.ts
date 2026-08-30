import { FIXED_DT } from '@/config/constants';
import {
  completeConstructionOrder,
  completeTeardownOrder,
} from '@/model/construction';
import { stockpileFromCost } from '@/model/storage';
import { totalOrderCost } from '@/model/construction/orders';
import type { Store } from '@/store/store';

let testBuiltRoomCounter = 0;

export function resetTestBuiltRoomCounter(): void {
  testBuiltRoomCounter = 0;
}

/** Force-complete all pending construction orders (unit tests). */
export function instantCompleteConstruction(store: Store): void {
  const game = store.getSnapshot().game;
  const nextRoomId = () => `test-built-${testBuiltRoomCounter++}`;
  const orders = [...game.constructionOrders];
  for (const order of orders) {
    if (order.kind === 'build') {
      const cost = stockpileFromCost(totalOrderCost(order.blueprintId, game.tower, order.origin));
      order.onSiteMaterials = cost;
      order.buildProgress = 1;
      order.status = 'building';
      completeConstructionOrder(game, order, nextRoomId);
    } else {
      completeTeardownOrder(game, order);
    }
  }
}

/** Advance sim until construction orders finish, without auto day/night transitions. */
export function completeConstruction(store: Store, maxSeconds = 120): void {
  const { game } = store.getSnapshot();
  const wasPaused = game.phasePaused;
  game.phasePaused = true;
  const maxSteps = Math.ceil(maxSeconds / FIXED_DT);
  for (let i = 0; i < maxSteps; i += 1) {
    store.advance(FIXED_DT);
    if (store.getSnapshot().game.constructionOrders.length === 0) break;
  }
  if (store.getSnapshot().game.constructionOrders.length > 0) {
    instantCompleteConstruction(store);
  }
  store.getSnapshot().game.phasePaused = wasPaused;
}
