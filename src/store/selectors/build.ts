import { availableInStorage, stockpileFromCost, totalReserved } from '@/model/storage';
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
import { totalOrderCost } from '@/model/construction';
import { planFortificationPlacement } from '@/model/fortificationPlacement';
import { planInfraPlacement } from '@/model/infraPlacement';
import { selectPipeConnectivityReport } from '@/model/pipes';
import { selectLogisticsReport } from '@/model/staff/connectivity';
import { housingKindOf, staffKindForHousing } from '@/model/staff/capacity';
import { isOverhangUnlocked } from '@/model/research';
import { canPlace, getUnstableStructureIds, planRoomPlacement, type StructurePlacementOptions } from '@/model/tower';
import { validateLeylineRoomPlacement } from '@/model/spells/progression';
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

function structurePlacementOptions(snapshot: Snapshot): StructurePlacementOptions {
  return { overhangUnlocked: isOverhangUnlocked(snapshot.game) };
}

export interface BuildEconomy {
  isPlanning: boolean;
  remaining: Resources;
  committed: Resources;
  budget: Resources;
  remainingGold: number;
  committedGold: number;
  budgetGold: number;
  /** Stone+metal available in storage (unreserved). */
  storageAvailable: { stone: number; metal: number };
}

export function selectBuildEconomy(snapshot: Snapshot): BuildEconomy {
  const { game } = snapshot;
  const wallet = game.player.resources;
  const storage = availableInStorage(game);
  const reserved = totalReserved(game);

  const remaining: Resources = {
    gold: wallet.gold - game.pendingRecruitSpend,
    souls: wallet.souls,
    stone: storage.stone,
    metal: storage.metal,
  };
  const committed = addResources(asResources(reserved), { gold: game.pendingRecruitSpend });
  const budget = addResources(
    { ...wallet, stone: storage.stone + reserved.stone, metal: storage.metal + reserved.metal },
    { gold: game.pendingRecruitSpend },
  );

  return {
    isPlanning: game.scene === 'run' && game.phase === 'day',
    remaining,
    committed,
    budget,
    remainingGold: remaining.gold,
    committedGold: committed.gold,
    budgetGold: budget.gold,
    storageAvailable: storage,
  };
}

export function canAffordOrder(snapshot: Snapshot, blueprintId: string, origin: Cell): boolean {
  const { game } = snapshot;
  const cost = totalOrderCost(blueprintId, game.tower, origin);
  const physical = stockpileFromCost(cost);
  const avail = availableInStorage(game);
  if (avail.stone < physical.stone || avail.metal < physical.metal) return false;
  if ((cost.souls ?? 0) > game.player.resources.souls) return false;
  if ((cost.gold ?? 0) > game.player.resources.gold - game.pendingRecruitSpend) return false;
  return true;
}

export interface BuildUndoState {
  canUndo: boolean;
  canRevert: boolean;
}

export function selectBuildUndoState(snapshot: Snapshot): BuildUndoState {
  const { game } = snapshot;
  const inDay = game.scene === 'run' && game.phase === 'day';
  if (!inDay) return { canUndo: false, canRevert: false };
  return {
    canUndo: game.constructionOrders.length > 0,
    canRevert: game.constructionOrders.length > 0,
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
  infraKind?: InfraKind;
  needsStem?: boolean;
  stemCells?: Cell[];
}

export function selectGhostPlacement(snapshot: Snapshot): GhostPlacement | null {
  const { game, view } = snapshot;
  if (game.scene !== 'run' || game.phase !== 'day') return null;
  const id = view.selectedBlueprintId;
  if (!id || !view.hoveredCell) return null;

  if (isInfraBlueprint(id)) {
    const blueprint = getInfraBlueprint(id);
    if (!blueprint?.infraKind) return null;
    const placementOptions = structurePlacementOptions(snapshot);
    const plan = planInfraPlacement(game.tower, blueprint, view.hoveredCell, placementOptions);
    return {
      cells: [view.hoveredCell],
      valid: plan.ok && canAffordOrder(snapshot, id, view.hoveredCell),
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
      valid: (plan.ok || plan.isToggleOff) && canAffordOrder(snapshot, id, view.hoveredCell),
      reason: plan.isToggleOff ? 'ok' : plan.reason,
      needsStem: plan.needsStem,
      stemCells: plan.needsStem ? [view.hoveredCell] : [],
    };
  }

  const blueprint = selectSelectedBlueprint(snapshot);
  if (!blueprint) return null;

  if (isStructureBlueprint(blueprint)) {
    const result = canPlace(game.tower, blueprint, view.hoveredCell, structurePlacementOptions(snapshot));
    return {
      cells: roomCells(view.hoveredCell, blueprint.size),
      valid: result.ok && canAffordOrder(snapshot, id, view.hoveredCell),
      reason: result.reason,
    };
  }

  const plan = planRoomPlacement(game.tower, blueprint, view.hoveredCell, structurePlacementOptions(snapshot));
  let reason = plan.reason;
  let valid = plan.ok;
  if (plan.ok) {
    const leyline = validateLeylineRoomPlacement(game, blueprint.id, view.hoveredCell, blueprint.size);
    if (leyline && !leyline.ok) {
      valid = false;
      reason = leyline.reason;
    }
  }
  return {
    cells: roomCells(view.hoveredCell, blueprint.size),
    valid: valid && canAffordOrder(snapshot, id, view.hoveredCell),
    reason,
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
  if (b.id === 'scaffold') return null;
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

  const infra = INFRA_BLUEPRINTS.filter((b) => unlocked.has(b.id))
    .map((b) => toLibraryItem(b, remaining, view.selectedBlueprintId, 'infra'))
    .filter((b): b is LibraryBlueprintItem => b !== null);

  const forts = FORTIFICATION_BLUEPRINTS.filter((b) => unlocked.has(b.id))
    .map((b) => toLibraryItem(b, remaining, view.selectedBlueprintId, 'fortification'))
    .filter((b): b is LibraryBlueprintItem => b !== null);

  return [...framing, ...rooms, ...infra, ...forts];
}

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

export interface ProspectAllocationInfo {
  current: number;
  max: number;
}

export function selectProspectAllocation(snapshot: Snapshot): ProspectAllocationInfo {
  const { game } = snapshot;
  let totalLaborers = 0;
  for (const room of game.tower.rooms) {
    if (room.blueprintId !== 'quartersRoom') continue;
    totalLaborers += game.housingRecruited[room.id] ?? 0;
  }
  const max = Math.min(6, totalLaborers);
  return { current: game.prospectAllocation, max };
}

export function selectRoomBuildAlerts(snapshot: Snapshot): RoomBuildAlert[] {
  const { game } = snapshot;
  if (game.scene !== 'run' || game.phase !== 'day') return [];

  const alerts: RoomBuildAlert[] = [];

  for (const room of game.tower.rooms) {
    const housing = housingKindOf(room);
    if (housing && (game.housingRecruited[room.id] ?? 0) < 1) {
      const kind = staffKindForHousing(housing);
      const label = kind === 'soldier' ? 'Soldier' : kind === 'mage' ? 'Mage' : 'Laborer';
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
  if (game.scene !== 'run' || game.phase !== 'day') return [];
  return [...getUnstableStructureIds(game.tower, isOverhangUnlocked(game))].map((structureId) => ({
    structureId,
    message: 'Needs support',
  }));
}

export function selectConstructionOrders(snapshot: Snapshot) {
  return snapshot.game.constructionOrders;
}

export function selectPhaseInfo(snapshot: Snapshot) {
  const { game } = snapshot;
  return {
    phase: game.phase,
    dayIndex: game.dayIndex,
    phaseTimer: game.phaseTimer,
    phasePaused: game.phasePaused,
  };
}
