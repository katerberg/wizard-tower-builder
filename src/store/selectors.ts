import { getBlueprint } from '@/model/blueprints';
import { roomCells } from '@/calculations/grid';
import { canPlace, getUnstableRoomIds, getWizardPosition } from '@/model/tower';
import type { Blueprint, Cell, ExteriorNode, PlacementReason, Room } from '@/model/types';
import type { Snapshot } from './store';

export function selectWizardPosition(snapshot: Snapshot): ExteriorNode {
  return getWizardPosition(snapshot.game.tower);
}

export type TowerStability = { stable: boolean; unstableRoomIds: Set<string> };

export function selectTowerStability(snapshot: Snapshot): TowerStability {
  const unstableRoomIds = getUnstableRoomIds(snapshot.game.tower);
  return { stable: unstableRoomIds.size === 0, unstableRoomIds };
}

export function selectSelectedBlueprint(snapshot: Snapshot): Blueprint | undefined {
  const id = snapshot.view.selectedBlueprintId;
  return id ? getBlueprint(id) : undefined;
}

export function selectRoomById(snapshot: Snapshot, roomId: string): Room | undefined {
  return snapshot.game.tower.rooms.find((r) => r.id === roomId);
}

export type GhostPlacement = {
  cells: Cell[];
  valid: boolean;
  reason: PlacementReason;
};

export function selectGhostPlacement(snapshot: Snapshot): GhostPlacement | null {
  const { game, view } = snapshot;
  if (game.scene !== 'run' || game.phase !== 'build') return null;
  const blueprint = selectSelectedBlueprint(snapshot);
  if (!blueprint || !view.hoveredCell) return null;

  const result = canPlace(game.tower, blueprint, view.hoveredCell);
  return {
    cells: roomCells(view.hoveredCell, blueprint.size),
    valid: result.ok,
    reason: result.reason,
  };
}
