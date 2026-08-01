import {
  LABORER_RECRUIT_COST,
  MAGE_RECRUIT_COST,
  SOLDIER_RECRUIT_COST,
} from '@/config/constants';
import { computeRoomStats, computeStructureStats } from '@/calculations/combat';
import {
  canAffordResources,
  formatResourceCost,
} from '@/calculations/resources';
import {
  canApplyModification,
  canUpgradeModification,
  formatModificationMechanics,
  listModifications,
  modificationCost,
} from '@/model/modifications';
import { isManaSpringRoom } from '@/model/pipes';
import {
  housingCapacity,
  isHousingRoom,
  isSlotRoom,
  manaSpringStaffCapacity,
  slotCapacity,
  housingKindOf,
  staffKindForHousing,
} from '@/model/staff/capacity';
import { selectConnectivityReport } from '@/model/staff/connectivity';
import { getEffectiveWizardPosition } from '@/model/spells';
import { getBlueprint } from '@/model/blueprints';
import { getUnstableStructureIds, structureAt } from '@/model/tower';
import type {
  Blueprint,
  ExteriorNode,
  Room,
  RoomStats,
  StaffKind,
  Structure,
} from '@/model/types';
import type { Snapshot } from '../store';
import {
  selectBuildEconomy,
  selectRoomBuildAlerts,
  selectStructureBuildAlerts,
} from './build';

function recruitCostFor(kind: StaffKind): number {
  switch (kind) {
    case 'soldier':
      return SOLDIER_RECRUIT_COST;
    case 'mage':
      return MAGE_RECRUIT_COST;
    case 'laborer':
      return LABORER_RECRUIT_COST;
  }
}

export function selectWizardPosition(snapshot: Snapshot): ExteriorNode {
  return getEffectiveWizardPosition(snapshot.game);
}

export interface TowerStability {
  stable: boolean;
  unstableRoomIds: Set<string>;
  unstableStructureIds: Set<string>;
}

export function selectTowerStability(snapshot: Snapshot): TowerStability {
  const unstableStructureIds = getUnstableStructureIds(snapshot.game.tower);
  return {
    stable: unstableStructureIds.size === 0,
    unstableRoomIds: unstableStructureIds,
    unstableStructureIds,
  };
}

export function selectRoomById(snapshot: Snapshot, roomId: string): Room | undefined {
  return snapshot.game.tower.rooms.find((r) => r.id === roomId);
}

export interface RoomModificationOption {
  id: string;
  name: string;
  glyph: string;
  color: string;
  description: string;
  mechanics: string;
  level: number;
  maxLevel: number;
  levelText: string;
  action: 'none' | 'add' | 'upgrade' | 'max';
  cost: import('@/model/types').ResourceCost;
  costLabel: string;
  enabled: boolean;
}

function modOptionFields(
  def: ReturnType<typeof listModifications>[number],
  level: number,
  action: RoomModificationOption['action'],
): Pick<RoomModificationOption, 'description' | 'mechanics'> {
  return {
    description: def.description,
    mechanics: formatModificationMechanics(def, level, action),
  };
}

export interface RoomInspector {
  room: Room;
  blueprint: Blueprint;
  stats: RoomStats;
  isBuildPhase: boolean;
  modifications: RoomModificationOption[];
  canRemove: boolean;
  /** Framing under this room (secondary inspector info). */
  underStructure?: { id: string; name: string; hp: number; maxHp: number };
  housingRecruited?: number;
  housingCapacity?: number;
  housingStaffKind?: 'soldier' | 'mage' | 'laborer';
  recruitCost?: number;
  slotAllocated?: number;
  slotCapacity?: number;
  slotConnected?: boolean;
  manaSpringAllocated?: number;
  manaSpringCapacity?: number;
  /** Contextual build warning shown on this room (missing stairs, support, …). */
  buildAlert?: string;
}

export interface StructureInspector {
  structure: Structure;
  blueprint: Blueprint;
  maxHp: number;
  isBuildPhase: boolean;
  canRemove: boolean;
  buildAlert?: string;
}

export function selectRoomInspector(snapshot: Snapshot, roomId: string): RoomInspector | null {
  const room = selectRoomById(snapshot, roomId);
  if (!room) return null;

  const blueprint = getBlueprint(room.blueprintId);
  if (!blueprint) return null;

  const { game } = snapshot;
  const isBuildPhase = game.scene === 'run' && game.phase === 'build';
  const { remaining } = selectBuildEconomy(snapshot);
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
        ...modOptionFields(def, level, 'none'),
        level,
        maxLevel: def.maxLevel,
        levelText,
        action: 'none' as const,
        cost: {},
        costLabel: '—',
        enabled: false,
      };
    }

    if (level === 0) {
      const cost = modificationCost(def, 1);
      const enabled =
        canApplyModification(room, game.tower, def.id) && canAffordResources(remaining, cost);
      return {
        id: def.id,
        name: def.name,
        glyph: def.glyph,
        color: def.color,
        ...modOptionFields(def, level, 'add'),
        level,
        maxLevel: def.maxLevel,
        levelText,
        action: 'add' as const,
        cost,
        costLabel: formatResourceCost(cost),
        enabled,
      };
    }

    if (canUpgradeModification(room, def.id)) {
      const cost = modificationCost(def, level + 1);
      const enabled = canAffordResources(remaining, cost);
      return {
        id: def.id,
        name: def.name,
        glyph: def.glyph,
        color: def.color,
        ...modOptionFields(def, level, 'upgrade'),
        level,
        maxLevel: def.maxLevel,
        levelText,
        action: 'upgrade' as const,
        cost,
        costLabel: formatResourceCost(cost),
        enabled,
      };
    }

    return {
      id: def.id,
      name: def.name,
      glyph: def.glyph,
      color: def.color,
      ...modOptionFields(def, level, 'max'),
      level,
      maxLevel: def.maxLevel,
      levelText,
      action: 'max' as const,
      cost: {},
      costLabel: '—',
      enabled: false,
    };
  });

  const housing = housingKindOf(room);
  const staffKind = housing ? staffKindForHousing(housing) : undefined;

  const under = structureAt(game.tower, room.origin.col, room.origin.row);
  const underBp = under ? getBlueprint(under.blueprintId) : undefined;
  const underStructure =
    under && underBp
      ? {
          id: under.id,
          name: underBp.name,
          hp: under.hp,
          maxHp: computeStructureStats(under, underBp).maxHp,
        }
      : undefined;

  return {
    room,
    blueprint,
    stats,
    isBuildPhase,
    modifications,
    canRemove: isBuildPhase,
    underStructure,
    housingRecruited: isHousingRoom(room) ? (game.housingRecruited[room.id] ?? 0) : undefined,
    housingCapacity: isHousingRoom(room) ? housingCapacity(room) : undefined,
    housingStaffKind: staffKind,
    recruitCost: staffKind ? recruitCostFor(staffKind) : undefined,
    slotAllocated: isSlotRoom(room) ? (game.slotAllocations[room.id] ?? 0) : undefined,
    slotCapacity: isSlotRoom(room) ? slotCapacity(room) : undefined,
    slotConnected: isSlotRoom(room)
      ? selectConnectivityReport(game).slots.find((s) => s.slotId === room.id)?.connected ?? true
      : undefined,
    manaSpringAllocated: isManaSpringRoom(room)
      ? (game.manaSpringAllocations[room.id] ?? 0)
      : undefined,
    manaSpringCapacity: isManaSpringRoom(room) ? manaSpringStaffCapacity() : undefined,
    buildAlert: selectRoomBuildAlerts(snapshot).find((a) => a.roomId === room.id)?.message,
  };
}

export function selectStructureInspector(
  snapshot: Snapshot,
  structureId: string,
): StructureInspector | null {
  const structure = (snapshot.game.tower.structures ?? []).find((s) => s.id === structureId);
  if (!structure) return null;
  const blueprint = getBlueprint(structure.blueprintId);
  if (!blueprint) return null;
  const isBuildPhase = snapshot.game.scene === 'run' && snapshot.game.phase === 'build';
  return {
    structure,
    blueprint,
    maxHp: computeStructureStats(structure, blueprint).maxHp,
    isBuildPhase,
    canRemove: isBuildPhase,
    buildAlert: selectStructureBuildAlerts(snapshot).find((a) => a.structureId === structureId)
      ?.message,
  };
}

