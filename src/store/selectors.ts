import { BLUEPRINTS, getBlueprint } from '@/model/blueprints';
import { INFRA_BLUEPRINTS, getInfraBlueprint, isInfraBlueprint } from '@/model/infraBlueprints';
import { canPlaceInfra } from '@/model/infra';
import { selectConnectivityReport } from '@/model/soldiers/connectivity';
import { barracksCapacity, isBarracksRoom, isSlotRoom, slotCapacity } from '@/model/soldiers/capacity';
import { netBuildCost, remainingBuildGold } from '@/calculations/buildCost';
import { computeRoomStats } from '@/calculations/combat';
import { roomCells } from '@/calculations/grid';
import {
  canApplyModification,
  canUpgradeModification,
  listModifications,
  modificationCost,
} from '@/model/modifications';
import { canPlace, getUnstableRoomIds, getWizardPosition, towersEqual } from '@/model/tower';
import type { Blueprint, Cell, ExteriorNode, PlacementReason, Room, RoomStats } from '@/model/types';
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
  const committedGold = netBuildCost(baseline, game.tower) + game.buildRecruitSpend;
  return {
    isPlanning: true,
    remainingGold: remainingBuildGold(baseline, game.tower, game.buildRecruitSpend),
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
  if (!id) return undefined;
  return getBlueprint(id) ?? getInfraBlueprint(id);
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
  const id = view.selectedBlueprintId;
  if (!id || !view.hoveredCell) return null;

  if (isInfraBlueprint(id)) {
    const blueprint = getInfraBlueprint(id);
    if (!blueprint) return null;
    const valid = canPlaceInfra(game.tower, blueprint, view.hoveredCell);
    return {
      cells: [view.hoveredCell],
      valid,
      reason: valid ? 'ok' : 'overlap',
    };
  }

  const blueprint = selectSelectedBlueprint(snapshot);
  if (!blueprint) return null;

  const result = canPlace(game.tower, blueprint, view.hoveredCell);
  return {
    cells: roomCells(view.hoveredCell, blueprint.size),
    valid: result.ok,
    reason: result.reason,
  };
}

export interface LibraryBlueprintItem {
  id: string;
  name: string;
  glyph: string;
  sizeW: number;
  sizeH: number;
  cost: number;
  baseHp: number;
  affordable: boolean;
  selected: boolean;
  category: 'structure' | 'infra';
}

export function selectLibraryBlueprints(snapshot: Snapshot): LibraryBlueprintItem[] {
  const { game, view } = snapshot;
  const { remainingGold } = selectBuildEconomy(snapshot);
  const unlocked = new Set(game.player.unlockedBlueprints);

  const structure = BLUEPRINTS.filter((b) => unlocked.has(b.id)).map((b) => ({
    id: b.id,
    name: b.name,
    glyph: b.glyph,
    sizeW: b.size.w,
    sizeH: b.size.h,
    cost: b.cost,
    baseHp: b.baseHp,
    affordable: remainingGold >= b.cost,
    selected: view.selectedBlueprintId === b.id,
    category: 'structure' as const,
  }));

  const infra = INFRA_BLUEPRINTS.map((b) => ({
    id: b.id,
    name: b.name,
    glyph: b.glyph,
    sizeW: b.size.w,
    sizeH: b.size.h,
    cost: b.cost,
    baseHp: b.baseHp,
    affordable: remainingGold >= b.cost,
    selected: view.selectedBlueprintId === b.id,
    category: 'infra' as const,
  }));

  return [...structure, ...infra];
}

export interface RoomModificationOption {
  id: string;
  name: string;
  glyph: string;
  color: string;
  description: string;
  level: number;
  maxLevel: number;
  levelText: string;
  action: 'none' | 'add' | 'upgrade' | 'max';
  cost: number;
  enabled: boolean;
}

export interface RoomInspector {
  room: Room;
  blueprint: Blueprint;
  stats: RoomStats;
  isBuildPhase: boolean;
  modifications: RoomModificationOption[];
  canRemove: boolean;
  barracksRecruited?: number;
  barracksCapacity?: number;
  slotAllocated?: number;
  slotCapacity?: number;
  slotConnected?: boolean;
}

export function selectConnectivityWarnings(snapshot: Snapshot): string[] {
  return selectConnectivityReport(snapshot.game).warnings;
}

export { selectConnectivityReport };

export function selectRoomInspector(snapshot: Snapshot, roomId: string): RoomInspector | null {
  const room = selectRoomById(snapshot, roomId);
  if (!room) return null;

  const blueprint = getBlueprint(room.blueprintId);
  if (!blueprint) return null;

  const { game } = snapshot;
  const isBuildPhase = game.scene === 'run' && game.phase === 'build';
  const { remainingGold } = selectBuildEconomy(snapshot);
  const stats = computeRoomStats(room, blueprint);

  const modifications = listModifications().map((def) => {
    const current = room.modifications.find((m) => m.id === def.id);
    const level = current?.level ?? 0;
    const levelText = level > 0 ? `Lv${level}/${def.maxLevel}` : 'not installed';

    if (!isBuildPhase) {
      return {
        id: def.id,
        name: def.name,
        glyph: def.glyph,
        color: def.color,
        description: def.description,
        level,
        maxLevel: def.maxLevel,
        levelText,
        action: 'none' as const,
        cost: 0,
        enabled: false,
      };
    }

    if (level === 0) {
      const cost = modificationCost(def, 1);
      const enabled = canApplyModification(room, game.tower, def.id) && remainingGold >= cost;
      return {
        id: def.id,
        name: def.name,
        glyph: def.glyph,
        color: def.color,
        description: def.description,
        level,
        maxLevel: def.maxLevel,
        levelText,
        action: 'add' as const,
        cost,
        enabled,
      };
    }

    if (canUpgradeModification(room, def.id)) {
      const cost = modificationCost(def, level + 1);
      const enabled = remainingGold >= cost;
      return {
        id: def.id,
        name: def.name,
        glyph: def.glyph,
        color: def.color,
        description: def.description,
        level,
        maxLevel: def.maxLevel,
        levelText,
        action: 'upgrade' as const,
        cost,
        enabled,
      };
    }

    return {
      id: def.id,
      name: def.name,
      glyph: def.glyph,
      color: def.color,
      description: def.description,
      level,
      maxLevel: def.maxLevel,
      levelText,
      action: 'max' as const,
      cost: 0,
      enabled: false,
    };
  });

  return {
    room,
    blueprint,
    stats,
    isBuildPhase,
    modifications,
    canRemove: isBuildPhase,
    barracksRecruited: isBarracksRoom(room) ? (game.barracksRecruited[room.id] ?? 0) : undefined,
    barracksCapacity: isBarracksRoom(room) ? barracksCapacity(room) : undefined,
    slotAllocated: isSlotRoom(room) ? (game.slotAllocations[room.id] ?? 0) : undefined,
    slotCapacity: isSlotRoom(room) ? slotCapacity(room) : undefined,
    slotConnected: isSlotRoom(room)
      ? selectConnectivityReport(game).slots.find((s) => s.slotId === room.id)?.connected ?? true
      : undefined,
  };
}
