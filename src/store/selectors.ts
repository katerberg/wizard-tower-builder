import { getBlueprint } from '@/model/blueprints';
import { netBuildCost, remainingBuildGold } from '@/calculations/buildCost';
import { roomCells } from '@/calculations/grid';
import { canPlace, getUnstableRoomIds, getWizardPosition, towersEqual } from '@/model/tower';
import type { Blueprint, Cell, ExteriorNode, PlacementReason, Room } from '@/model/types';
import type { Snapshot } from './store';

export interface BuildEconomy {
  isPlanning: boolean;
  remainingGold: number;
  committedGold: number;
  budget: number;
}

export function selectBuildEconomy(snapshot: Snapshot): BuildEconomy {
  const { game } = snapshot;
  const baseline = game.buildBaseline;
  if (game.scene !== 'run' || game.phase !== 'build' || !baseline) {
    return {
      isPlanning: false,
      remainingGold: game.player.currency,
      committedGold: 0,
      budget: game.player.currency,
    };
  }
  const committedGold = netBuildCost(baseline, game.tower);
  return {
    isPlanning: true,
    remainingGold: remainingBuildGold(baseline, game.tower),
    committedGold,
    budget: baseline.currency,
  };
}

export interface BuildUndoState {
  canUndo: boolean;
  canRevert: boolean;
}

export function selectBuildUndoState(snapshot: Snapshot): BuildUndoState {
  const { game } = snapshot;
  const baseline = game.buildBaseline;
  const inBuild = game.scene === 'run' && game.phase === 'build';
  if (!inBuild || !baseline) {
    return { canUndo: false, canRevert: false };
  }
  return {
    canUndo: snapshot.buildUndoDepth > 0,
    canRevert: !towersEqual(game.tower, baseline.tower),
  };
}

export function selectWizardPosition(snapshot: Snapshot): ExteriorNode {
  return getWizardPosition(snapshot.game.tower);
}

export interface TowerStability { stable: boolean; unstableRoomIds: Set<string> }

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

export interface GhostPlacement {
  cells: Cell[];
  valid: boolean;
  reason: PlacementReason;
}

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
