import { netBuildCost, remainingBuildResources } from '@/calculations/buildCost';
import {
  addResources,
  asResources,
  canAffordResources,
  formatResourceCost,
} from '@/calculations/resources';
import { roomCells } from '@/calculations/grid';
import { BLUEPRINTS, getBlueprint, isStructureBlueprint } from '@/model/blueprints';
import { INFRA_BLUEPRINTS, getInfraBlueprint, isInfraBlueprint } from '@/model/infraBlueprints';
import {
  FORTIFICATION_BLUEPRINTS,
  getFortificationBlueprint,
  isFortificationBlueprint,
} from '@/model/fortificationBlueprints';
import { planFortificationPlacement } from '@/model/fortifications/shell';
import { planInfraPlacement } from '@/model/infraPlacement';
import { selectPipeConnectivityReport } from '@/model/pipes';
import { selectLogisticsReport } from '@/model/staff/connectivity';
import { housingKindOf, staffKindForHousing } from '@/model/staff/capacity';
import { canPlace, getUnstableStructureIds, planRoomPlacement, towersEqual } from '@/model/tower';
import {
  LIBRARY_SECTIONS,
  librarySectionFor,
  type LibrarySectionId,
} from '@/store/librarySections';
import type {
  Blueprint,
  Cell,
  InfraKind,
  PlacementReason,
  Resources,
} from '@/model/types';
import type { Snapshot } from '../store';

export interface BuildEconomy {
  isPlanning: boolean;
  remaining: Resources;
  committed: Resources;
  budget: Resources;
  /** @deprecated Prefer remaining.gold */
  remainingGold: number;
  /** @deprecated Prefer committed.gold */
  committedGold: number;
  /** @deprecated Prefer budget.gold */
  budgetGold: number;
}

export function selectBuildEconomy(snapshot: Snapshot): BuildEconomy {
  const { game } = snapshot;
  const baseline = game.buildBaseline;
  if (game.scene !== 'run' || game.phase !== 'build' || !baseline) {
    const r = game.player.resources;
    return {
      isPlanning: false,
      remaining: r,
      committed: asResources({}),
      budget: r,
      remainingGold: r.gold,
      committedGold: 0,
      budgetGold: r.gold,
    };
  }
  const net = netBuildCost(baseline, game.tower);
  const committed = addResources(net, { gold: game.buildRecruitSpend });
  const remaining = remainingBuildResources(baseline, game.tower, game.buildRecruitSpend);
  return {
    isPlanning: true,
    remaining,
    committed,
    budget: baseline.resources,
    remainingGold: remaining.gold,
    committedGold: committed.gold,
    budgetGold: baseline.resources.gold,
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
  const staffChanged =
    JSON.stringify(game.housingRecruited) !== JSON.stringify(baseline.housingRecruited) ||
    JSON.stringify(game.slotAllocations) !== JSON.stringify(baseline.slotAllocations) ||
    JSON.stringify(game.manaSpringAllocations) !== JSON.stringify(baseline.manaSpringAllocations) ||
    game.buildRecruitSpend !== 0;
  return {
    canUndo: snapshot.buildUndoDepth > 0,
    canRevert: !towersEqual(game.tower, baseline.tower) || staffChanged,
  };
}

export function selectSelectedBlueprint(snapshot: Snapshot): Blueprint | undefined {
  const id = snapshot.view.selectedBlueprintId;
  if (!id) return undefined;
  return getBlueprint(id) ?? getInfraBlueprint(id) ?? getFortificationBlueprint(id);
}

export interface GhostPlacement {
  cells: Cell[];
  valid: boolean;
  reason: PlacementReason;
  /** When set, ghost renders as a thin infra line instead of a room fill. */
  infraKind?: InfraKind;
  /** When true, also preview the auto-placed Spire Block under empty cells. */
  needsStem?: boolean;
  /** Extra framing cells previewed when placing a room on empty cells. */
  stemCells?: Cell[];
}

export function selectGhostPlacement(snapshot: Snapshot): GhostPlacement | null {
  const { game, view } = snapshot;
  if (game.scene !== 'run' || game.phase !== 'build') return null;
  const id = view.selectedBlueprintId;
  if (!id || !view.hoveredCell) return null;

  if (isInfraBlueprint(id)) {
    const blueprint = getInfraBlueprint(id);
    if (!blueprint?.infraKind) return null;
    const plan = planInfraPlacement(game.tower, blueprint, view.hoveredCell);
    return {
      cells: [view.hoveredCell],
      valid: plan.ok,
      reason: plan.reason,
      infraKind: blueprint.infraKind,
      needsStem: plan.needsStem,
      stemCells: plan.needsStem ? [view.hoveredCell] : [],
    };
  }

  if (isFortificationBlueprint(id)) {
    const blueprint = getFortificationBlueprint(id);
    if (!blueprint?.id) return null;
    const kind = blueprint.id as import('@/model/types').FortificationId;
    const plan = planFortificationPlacement(game.tower, kind, view.hoveredCell);
    return {
      cells: [view.hoveredCell],
      valid: plan.ok || plan.isToggleOff,
      reason: plan.isToggleOff ? 'ok' : plan.reason,
    };
  }

  const blueprint = selectSelectedBlueprint(snapshot);
  if (!blueprint) return null;

  if (isStructureBlueprint(blueprint)) {
    const result = canPlace(game.tower, blueprint, view.hoveredCell);
    return {
      cells: roomCells(view.hoveredCell, blueprint.size),
      valid: result.ok,
      reason: result.reason,
    };
  }

  const plan = planRoomPlacement(game.tower, blueprint, view.hoveredCell);
  return {
    cells: roomCells(view.hoveredCell, blueprint.size),
    valid: plan.ok,
    reason: plan.reason,
    needsStem: plan.stemCells.length > 0,
    stemCells: plan.stemCells,
  };
}

export interface LibraryBlueprintItem {
  id: string;
  name: string;
  glyph: string;
  sizeW: number;
  sizeH: number;
  cost: Blueprint['cost'];
  costLabel: string;
  baseHp: number;
  affordable: boolean;
  selected: boolean;
  category: 'structure' | 'room' | 'infra' | 'fortification';
  section: LibrarySectionId;
}

export interface LibrarySection {
  id: LibrarySectionId;
  label: string;
  items: LibraryBlueprintItem[];
}

function toLibraryItem(
  b: Blueprint,
  remaining: Resources,
  selectedBlueprintId: string | null,
  category: 'structure' | 'room' | 'infra' | 'fortification',
): LibraryBlueprintItem | null {
  const section = librarySectionFor(b.id);
  if (!section) return null;
  return {
    id: b.id,
    name: b.name,
    glyph: b.glyph,
    sizeW: b.size.w,
    sizeH: b.size.h,
    cost: b.cost,
    costLabel: formatResourceCost(b.cost),
    baseHp: b.baseHp,
    affordable: canAffordResources(remaining, b.cost),
    selected: selectedBlueprintId === b.id,
    category,
    section,
  };
}

export function selectLibraryBlueprints(snapshot: Snapshot): LibraryBlueprintItem[] {
  const { game, view } = snapshot;
  const { remaining } = selectBuildEconomy(snapshot);
  const unlocked = new Set(game.player.unlockedBlueprints);

  const framing = BLUEPRINTS.filter((b) => unlocked.has(b.id) && isStructureBlueprint(b))
    .map((b) => toLibraryItem(b, remaining, view.selectedBlueprintId, 'structure'))
    .filter((b): b is LibraryBlueprintItem => b !== null);

  const rooms = BLUEPRINTS.filter((b) => unlocked.has(b.id) && !isStructureBlueprint(b))
    .map((b) => toLibraryItem(b, remaining, view.selectedBlueprintId, 'room'))
    .filter((b): b is LibraryBlueprintItem => b !== null);

  const infra = INFRA_BLUEPRINTS.map((b) =>
    toLibraryItem(b, remaining, view.selectedBlueprintId, 'infra'),
  ).filter((b): b is LibraryBlueprintItem => b !== null);

  const forts = FORTIFICATION_BLUEPRINTS.filter((b) => unlocked.has(b.id))
    .map((b) => toLibraryItem(b, remaining, view.selectedBlueprintId, 'fortification'))
    .filter((b): b is LibraryBlueprintItem => b !== null);

  return [...framing, ...rooms, ...infra, ...forts];
}

/** Blueprints grouped into sidebar sections (empty sections omitted). */
export function selectLibrarySections(snapshot: Snapshot): LibrarySection[] {
  const items = selectLibraryBlueprints(snapshot);
  return LIBRARY_SECTIONS.map((def) => ({
    id: def.id,
    label: def.label,
    items: items.filter((item) => item.section === def.id),
  })).filter((section) => section.items.length > 0);
}

export interface RoomBuildAlert {
  roomId: string;
  message: string;
}

export interface StructureBuildAlert {
  structureId: string;
  message: string;
}

/** Per-room build-phase warnings for canvas/modal (replaces a single HUD dump). */
export function selectRoomBuildAlerts(snapshot: Snapshot): RoomBuildAlert[] {
  const { game } = snapshot;
  if (game.scene !== 'run' || game.phase !== 'build') return [];

  const alerts: RoomBuildAlert[] = [];

  for (const room of game.tower.rooms) {
    const housing = housingKindOf(room);
    if (housing && (game.housingRecruited[room.id] ?? 0) < 1) {
      const kind = staffKindForHousing(housing);
      const label =
        kind === 'soldier' ? 'Soldier' : kind === 'mage' ? 'Mage' : 'Laborer';
      alerts.push({ roomId: room.id, message: `${label} deserted — recruit a replacement` });
    }
  }

  const logistics = selectLogisticsReport(game);
  for (const workplace of logistics.workplaces) {
    if (workplace.warning) {
      alerts.push({ roomId: workplace.roomId, message: workplace.warning });
    }
  }

  for (const pipeRoom of selectPipeConnectivityReport(game).rooms) {
    alerts.push({ roomId: pipeRoom.roomId, message: pipeRoom.warning });
  }

  return alerts;
}

export function selectStructureBuildAlerts(snapshot: Snapshot): StructureBuildAlert[] {
  const { game } = snapshot;
  if (game.scene !== 'run' || game.phase !== 'build') return [];
  return [...getUnstableStructureIds(game.tower)].map((structureId) => ({
    structureId,
    message: 'Needs support',
  }));
}
