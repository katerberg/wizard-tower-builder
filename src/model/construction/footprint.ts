import { getBlueprint } from '../blueprints';
import { getFortificationBlueprint } from '../fortificationBlueprints';
import { getInfraBlueprint } from '../infraBlueprints';
import { cellKey, roomCells } from '../../calculations/grid';
import type { Blueprint, Cell, ConstructionOrder } from '../types';

/** Blueprint for any order layer: framing, room, infra, or fortification. */
export function resolveOrderBlueprint(blueprintId: string): Blueprint | undefined {
  return (
    getBlueprint(blueprintId) ??
    getInfraBlueprint(blueprintId) ??
    getFortificationBlueprint(blueprintId)
  );
}

export function blueprintFootprintCells(blueprintId: string, origin: Cell): Cell[] {
  const bp = resolveOrderBlueprint(blueprintId);
  if (!bp) return [origin];
  return roomCells(origin, bp.size);
}

export function orderFootprintCells(order: ConstructionOrder): Cell[] {
  return blueprintFootprintCells(order.blueprintId, order.origin);
}

/** True when an order's footprint shares a cell with `cells` (paint replaces plans). */
export function ordersOverlapFootprint(order: ConstructionOrder, cells: Cell[]): boolean {
  const keys = new Set(cells.map((c) => cellKey(c.col, c.row)));
  return orderFootprintCells(order).some((c) => keys.has(cellKey(c.col, c.row)));
}
