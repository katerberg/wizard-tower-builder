import type { ResourceCost, Stockpile, StorageSite } from '../types';
import type { GameState } from '../types';

export function emptyStockpile(): Stockpile {
  return { stone: 0, metal: 0 };
}

export function stockpileUnits(s: Stockpile): number {
  return s.stone + s.metal;
}

export function addStockpiles(a: Stockpile, b: Stockpile): Stockpile {
  return { stone: a.stone + b.stone, metal: a.metal + b.metal };
}

export function subStockpiles(a: Stockpile, b: Stockpile): Stockpile {
  return {
    stone: Math.max(0, a.stone - b.stone),
    metal: Math.max(0, a.metal - b.metal),
  };
}

export function stockpileFromCost(cost: ResourceCost): Stockpile {
  return { stone: cost.stone ?? 0, metal: cost.metal ?? 0 };
}

export function canStockpileFit(site: StorageSite, add: Stockpile): boolean {
  return stockpileUnits(site.stockpile) + stockpileUnits(add) <= site.capacity;
}

/** Sum stockpile across all storage sites minus active reservations. */
export function availableInStorage(state: GameState): Stockpile {
  let stone = 0;
  let metal = 0;
  for (const site of Object.values(state.storageSites)) {
    stone += site.stockpile.stone;
    metal += site.stockpile.metal;
  }
  for (const res of state.storageReservations) {
    stone -= res.reserved.stone;
    metal -= res.reserved.metal;
  }
  return { stone: Math.max(0, stone), metal: Math.max(0, metal) };
}

export function totalReserved(state: GameState): Stockpile {
  let stone = 0;
  let metal = 0;
  for (const res of state.storageReservations) {
    stone += res.reserved.stone;
    metal += res.reserved.metal;
  }
  return { stone, metal };
}

/** Find nearest storage with enough unreserved stock for a cost (Manhattan from cell). */
export function findStorageForReservation(
  state: GameState,
  need: Stockpile,
  from: { col: number; row: number },
): string | null {
  const sites = Object.values(state.storageSites);
  const reservedByRoom = new Map<string, Stockpile>();
  for (const r of state.storageReservations) {
    const prev = reservedByRoom.get(r.storageRoomId) ?? emptyStockpile();
    reservedByRoom.set(r.storageRoomId, addStockpiles(prev, r.reserved));
  }

  let best: { id: string; dist: number } | null = null;
  for (const site of sites) {
    const reserved = reservedByRoom.get(site.roomId) ?? emptyStockpile();
    const free: Stockpile = {
      stone: site.stockpile.stone - reserved.stone,
      metal: site.stockpile.metal - reserved.metal,
    };
    if (free.stone < need.stone || free.metal < need.metal) continue;
    const room = state.tower.rooms.find((r) => r.id === site.roomId);
    if (!room) continue;
    const dist = Math.abs(room.origin.col - from.col) + Math.abs(room.origin.row - from.row);
    if (!best || dist < best.dist) best = { id: site.roomId, dist };
  }
  return best?.id ?? null;
}

export function reserveStorage(
  state: GameState,
  orderId: string,
  storageRoomId: string,
  amount: Stockpile,
): void {
  state.storageReservations.push({ orderId, storageRoomId, reserved: { ...amount } });
}

export function releaseReservation(state: GameState, orderId: string): void {
  state.storageReservations = state.storageReservations.filter((r) => r.orderId !== orderId);
}

/** Withdraw reserved materials when build completes or cancel with refund. */
export function consumeReservation(
  state: GameState,
  orderId: string,
  amount?: Stockpile,
): void {
  const res = state.storageReservations.find((r) => r.orderId === orderId);
  if (!res) return;
  const site = state.storageSites[res.storageRoomId];
  if (site) {
    const deduct = amount ?? res.reserved;
    site.stockpile.stone -= deduct.stone;
    site.stockpile.metal -= deduct.metal;
  }
  releaseReservation(state, orderId);
}

/** Deposit haul into nearest storage with space; returns overflow wasted. */
export function depositToStorage(
  state: GameState,
  haul: Stockpile,
  from?: { col: number; row: number },
): Stockpile {
  const left = { ...haul };
  const sites = Object.values(state.storageSites).sort((a, b) => {
    if (!from) return 0;
    const ra = state.tower.rooms.find((r) => r.id === a.roomId);
    const rb = state.tower.rooms.find((r) => r.id === b.roomId);
    if (!ra || !rb) return 0;
    const da = Math.abs(ra.origin.col - from.col) + Math.abs(ra.origin.row - from.row);
    const db = Math.abs(rb.origin.col - from.col) + Math.abs(rb.origin.row - from.row);
    return da - db;
  });

  for (const site of sites) {
    if (left.stone <= 0 && left.metal <= 0) break;
    const space = site.capacity - stockpileUnits(site.stockpile);
    if (space <= 0) continue;
    const toAdd: Stockpile = { stone: 0, metal: 0 };
    let remaining = space;
    const stoneAdd = Math.min(left.stone, remaining);
    toAdd.stone = stoneAdd;
    remaining -= stoneAdd;
    const metalAdd = Math.min(left.metal, remaining);
    toAdd.metal = metalAdd;
    site.stockpile.stone += toAdd.stone;
    site.stockpile.metal += toAdd.metal;
    left.stone -= toAdd.stone;
    left.metal -= toAdd.metal;
  }
  return left;
}

export function withdrawFromStorage(site: StorageSite, amount: Stockpile): Stockpile {
  const taken: Stockpile = {
    stone: Math.min(amount.stone, site.stockpile.stone),
    metal: Math.min(amount.metal, site.stockpile.metal),
  };
  site.stockpile.stone -= taken.stone;
  site.stockpile.metal -= taken.metal;
  return taken;
}

export function refundToNearestStorage(
  state: GameState,
  amount: Stockpile,
  from: { col: number; row: number },
): Stockpile {
  return depositToStorage(state, amount, from);
}

export function getStorageSite(state: GameState, roomId: string): StorageSite | undefined {
  return state.storageSites[roomId];
}

export function registerStorageSite(state: GameState, site: StorageSite): void {
  state.storageSites[site.roomId] = site;
}

export function canAffordPhysical(state: GameState, cost: ResourceCost): boolean {
  const need = stockpileFromCost(cost);
  const avail = availableInStorage(state);
  return avail.stone >= need.stone && avail.metal >= need.metal;
}

/** Spend stone/metal from storage sites (no reservation). Returns false if insufficient. */
export function spendPhysicalFromStorage(state: GameState, need: Stockpile): boolean {
  if (!canAffordPhysical(state, { stone: need.stone, metal: need.metal })) return false;
  const left = { ...need };
  for (const site of Object.values(state.storageSites)) {
    if (left.stone <= 0 && left.metal <= 0) break;
    const stoneTake = Math.min(left.stone, site.stockpile.stone);
    const metalTake = Math.min(left.metal, site.stockpile.metal);
    site.stockpile.stone -= stoneTake;
    site.stockpile.metal -= metalTake;
    left.stone -= stoneTake;
    left.metal -= metalTake;
  }
  return left.stone === 0 && left.metal === 0;
}
