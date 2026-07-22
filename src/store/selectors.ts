import {
  LABORER_RECRUIT_COST,
  MAGE_RECRUIT_COST,
  SOLDIER_RECRUIT_COST,
} from '@/config/constants';
import { BLUEPRINTS, getBlueprint, isStructureBlueprint } from '@/model/blueprints';
import { INFRA_BLUEPRINTS, getInfraBlueprint, isInfraBlueprint } from '@/model/infraBlueprints';
import { planInfraPlacement } from '@/model/infraPlacement';
import { selectLogisticsReport, selectConnectivityReport } from '@/model/staff/connectivity';
import { isManaSpringRoom, selectPipeConnectivityReport } from '@/model/pipes';
import {
  housingCapacity,
  isHousingRoom,
  isSlotRoom,
  manaSpringStaffCapacity,
  slotCapacity,
  housingKindOf,
  staffKindForHousing,
} from '@/model/staff/capacity';

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
import { netBuildCost, remainingBuildGold } from '@/calculations/buildCost';
import { computeRoomStats, computeStructureStats } from '@/calculations/combat';
import { roomCells } from '@/calculations/grid';
import {
  canApplyModification,
  canUpgradeModification,
  formatModificationMechanics,
  listModifications,
  modificationCost,
} from '@/model/modifications';
import { getRoomBehavior } from '@/model/roomBehaviors';
import {
  canCastSpell,
  enemyAtCell,
  getSpell,
  gridLine,
  tornadoGridLine,
  HOTBAR_SLOT_COUNT,
  listHotbarSpells,
  spellCooldownRemaining,
  gustAffectedCells,
  getEffectiveWizardPosition,
  blizzardZoneCells,
} from '@/model/spells';
import { MAX_CHARGE } from '@/model/spells/earth/constants';
import { aoeCells } from '@/model/spells/fireball';
import { canPlace, getUnstableStructureIds, planRoomPlacement, roomAt, structureAt, towersEqual } from '@/model/tower';
import { getBuildTool } from '@/static/buildTools';
import {
  LIBRARY_SECTIONS,
  librarySectionFor,
  type LibrarySectionId,
} from '@/static/librarySections';
import type {
  Blueprint,
  Cell,
  ExteriorNode,
  InfraKind,
  PlacementReason,
  Room,
  RoomStats,
  StaffKind,
  Structure,
} from '@/model/types';
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

export function selectWizardPosition(snapshot: Snapshot): ExteriorNode {
  return getEffectiveWizardPosition(snapshot.game);
}

export interface TowerStability { stable: boolean; unstableRoomIds: Set<string>; unstableStructureIds: Set<string> }

export function selectTowerStability(snapshot: Snapshot): TowerStability {
  const unstableStructureIds = getUnstableStructureIds(snapshot.game.tower);
  return {
    stable: unstableStructureIds.size === 0,
    unstableRoomIds: unstableStructureIds,
    unstableStructureIds,
  };
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
  cost: number;
  baseHp: number;
  affordable: boolean;
  selected: boolean;
  category: 'structure' | 'room' | 'infra';
  section: LibrarySectionId;
}

export interface LibrarySection {
  id: LibrarySectionId;
  label: string;
  items: LibraryBlueprintItem[];
}

function toLibraryItem(
  b: Blueprint,
  remainingGold: number,
  selectedBlueprintId: string | null,
  category: 'structure' | 'room' | 'infra',
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
    baseHp: b.baseHp,
    affordable: remainingGold >= b.cost,
    selected: selectedBlueprintId === b.id,
    category,
    section,
  };
}

export function selectLibraryBlueprints(snapshot: Snapshot): LibraryBlueprintItem[] {
  const { game, view } = snapshot;
  const { remainingGold } = selectBuildEconomy(snapshot);
  const unlocked = new Set(game.player.unlockedBlueprints);

  const framing = BLUEPRINTS.filter((b) => unlocked.has(b.id) && isStructureBlueprint(b))
    .map((b) => toLibraryItem(b, remainingGold, view.selectedBlueprintId, 'structure'))
    .filter((b): b is LibraryBlueprintItem => b !== null);

  const rooms = BLUEPRINTS.filter((b) => unlocked.has(b.id) && !isStructureBlueprint(b))
    .map((b) => toLibraryItem(b, remainingGold, view.selectedBlueprintId, 'room'))
    .filter((b): b is LibraryBlueprintItem => b !== null);

  const infra = INFRA_BLUEPRINTS.map((b) =>
    toLibraryItem(b, remainingGold, view.selectedBlueprintId, 'infra'),
  ).filter((b): b is LibraryBlueprintItem => b !== null);

  return [...framing, ...rooms, ...infra];
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
  cost: number;
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

export function selectConnectivityWarnings(snapshot: Snapshot): string[] {
  return selectLogisticsReport(snapshot.game).warnings;
}

export function selectLogisticsWarnings(snapshot: Snapshot): string[] {
  return selectLogisticsReport(snapshot.game).warnings;
}

export { selectConnectivityReport, selectLogisticsReport };

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
        ...modOptionFields(def, level, 'none'),
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
        ...modOptionFields(def, level, 'add'),
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
        ...modOptionFields(def, level, 'upgrade'),
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
      ...modOptionFields(def, level, 'max'),
      level,
      maxLevel: def.maxLevel,
      levelText,
      action: 'max' as const,
      cost: 0,
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

export interface ManaState {
  current: number;
  max: number;
  /** Display string rounded to the nearest tenth. */
  label: string;
}

export function selectMana(snapshot: Snapshot): ManaState {
  const { player } = snapshot.game;
  const current = Math.round(player.mana * 10) / 10;
  const max = player.maxMana;
  return {
    current,
    max,
    label: `${current.toFixed(1)} / ${max}`,
  };
}

export interface ChargeState {
  current: number;
  max: number;
  fortified: boolean;
  label: string;
}

export function selectEarthCharge(snapshot: Snapshot): ChargeState {
  const { game } = snapshot;
  const current = game.earthCharge ?? 0;
  const max = MAX_CHARGE;
  return {
    current,
    max,
    fortified: game.fortified === true,
    label: `${current} / ${max}${game.fortified ? ' · Fortified' : ''}`,
  };
}

export interface SpellBarSlot {
  hotkey: number;
  id: string | null;
  name: string | null;
  glyph: string | null;
  manaCost: number | null;
  cooldownRemaining: number;
  selected: boolean;
  enabled: boolean;
  disabledReason: string | null;
  empty: boolean;
}

export function selectSpellBar(snapshot: Snapshot): SpellBarSlot[] {
  const { game, view } = snapshot;
  if (game.scene !== 'run') return [];

  const inAttack = game.phase === 'attack';
  const spells = listHotbarSpells(game);
  const slots: SpellBarSlot[] = [];

  for (let i = 0; i < HOTBAR_SLOT_COUNT; i++) {
    const spell = spells[i];
    const hotkey = i + 1;
    if (!spell) {
      slots.push({
        hotkey,
        id: null,
        name: null,
        glyph: null,
        manaCost: null,
        cooldownRemaining: 0,
        selected: false,
        enabled: false,
        disabledReason: null,
        empty: true,
      });
      continue;
    }

    if (!inAttack) {
      slots.push({
        hotkey,
        id: spell.id,
        name: spell.name,
        glyph: spell.glyph,
        manaCost: spell.manaCost,
        cooldownRemaining: 0,
        selected: false,
        enabled: false,
        disabledReason: null,
        empty: false,
      });
      continue;
    }

    const onCooldown = spellCooldownRemaining(game, spell.id) > 0;
    const noMana = game.player.mana < spell.manaCost;
    const check = canCastSpell(game, spell.id);
    let disabledReason: string | null = null;
    if (!check.ok && (check.reason === 'concentrating' || check.reason === 'no_charge')) {
      disabledReason = check.reason === 'no_charge' ? 'no charge' : 'fortified';
    } else if (onCooldown) disabledReason = 'cooldown';
    else if (noMana) disabledReason = 'no mana';

    slots.push({
      hotkey,
      id: spell.id,
      name: spell.name,
      glyph: spell.glyph,
      manaCost: spell.manaCost,
      cooldownRemaining: spellCooldownRemaining(game, spell.id),
      selected: view.selectedSpellId === spell.id,
      enabled: disabledReason == null,
      disabledReason,
      empty: false,
    });
  }

  return slots;
}

export interface CastPreview {
  cells: Cell[];
  valid: boolean;
  reason: string;
}

export function selectCastPreview(snapshot: Snapshot): CastPreview | null {
  const { game, view } = snapshot;
  if (game.scene !== 'run' || game.phase !== 'attack') return null;
  const spellId = view.selectedSpellId;
  if (!spellId || !view.hoveredCell) return null;

  const spell = getSpell(spellId);
  if (!spell || spell.autoCast) return null;

  if (spell.targeting === 'gridPoint') {
    const result = canCastSpell(game, spellId, { kind: 'cell', cell: view.hoveredCell });
    const cells =
      spell.id === 'gust'
        ? gustAffectedCells(view.hoveredCell)
        : spell.id === 'blizzard'
          ? blizzardZoneCells(view.hoveredCell)
          : aoeCells(view.hoveredCell, spell.aoeRadius ?? 0);
    return {
      cells,
      valid: result.ok,
      reason: result.ok ? 'ok' : result.reason,
    };
  }

  if (spell.targeting === 'trapAdjacent') {
    const result = canCastSpell(game, spellId, { kind: 'cell', cell: view.hoveredCell });
    return {
      cells: [view.hoveredCell],
      valid: result.ok,
      reason: result.ok ? 'ok' : result.reason,
    };
  }

  if (spell.targeting === 'room') {
    const result = canCastSpell(game, spellId, { kind: 'cell', cell: view.hoveredCell });
    const room = roomAt(game.tower, view.hoveredCell.col, view.hoveredCell.row);
    const cells = room ? roomCells(room.origin, room.size) : [view.hoveredCell];
    return {
      cells,
      valid: result.ok,
      reason: result.ok ? 'ok' : result.reason,
    };
  }

  if (spell.targeting === 'enemy') {
    const enemy = enemyAtCell(game, view.hoveredCell);
    const result = enemy
      ? canCastSpell(game, spellId, { kind: 'enemy', enemyId: enemy.id })
      : { ok: false as const, reason: 'no_target' as const };
    return {
      cells: enemy ? [view.hoveredCell] : [],
      valid: result.ok,
      reason: result.ok ? 'ok' : result.reason,
    };
  }

  if (spell.targeting === 'segment') {
    if (!view.castAnchor) {
      const result = canCastSpell(game, spellId, { kind: 'cell', cell: view.hoveredCell });
      return {
        cells: [view.hoveredCell],
        valid: result.ok,
        reason: result.ok ? 'ok' : result.reason,
      };
    }
    const line = gridLine(view.castAnchor, view.hoveredCell);
    const result = line
      ? canCastSpell(game, spellId, { kind: 'segment', from: view.castAnchor, to: view.hoveredCell })
      : { ok: false as const, reason: 'invalid_segment' as const };
    return {
      cells: line ?? [view.castAnchor, view.hoveredCell],
      valid: result.ok,
      reason: result.ok ? 'ok' : result.reason,
    };
  }

  if (spell.targeting === 'airSegment') {
    if (!view.castAnchor) {
      const result = canCastSpell(game, spellId, { kind: 'cell', cell: view.hoveredCell });
      return {
        cells: [view.hoveredCell, { col: view.hoveredCell.col, row: view.hoveredCell.row + 1 }],
        valid: result.ok,
        reason: result.ok ? 'ok' : result.reason,
      };
    }
    const line = tornadoGridLine(view.castAnchor, view.hoveredCell);
    const previewCells = line
      ? line.flatMap((c) => [c, { col: c.col, row: c.row + 1 }])
      : [view.castAnchor, view.hoveredCell];
    const result = line
      ? canCastSpell(game, spellId, { kind: 'segment', from: view.castAnchor, to: view.hoveredCell })
      : { ok: false as const, reason: 'invalid_segment' as const };
    return {
      cells: previewCells,
      valid: result.ok,
      reason: result.ok ? 'ok' : result.reason,
    };
  }

  return null;
}

export function selectCanCastSpell(
  snapshot: Snapshot,
  spellId: string,
  cell: Cell,
): { valid: boolean; reason: string } {
  const result = canCastSpell(snapshot.game, spellId, { kind: 'cell', cell });
  return { valid: result.ok, reason: result.ok ? 'ok' : result.reason };
}

export interface UiTooltipStat {
  label: string;
  value: string;
  accent?: boolean;
}

export interface UiTooltipContent {
  title: string;
  glyph: string;
  glyphColor?: string;
  description: string;
  stats: UiTooltipStat[];
  footer?: string;
}

export type UiTooltipTarget =
  | { kind: 'spell'; id: string }
  | { kind: 'blueprint'; id: string }
  | { kind: 'tool'; id: string };

export function selectUiTooltip(snapshot: Snapshot, target: UiTooltipTarget): UiTooltipContent | null {
  switch (target.kind) {
    case 'spell':
      return selectSpellTooltip(snapshot, target.id);
    case 'blueprint':
      return selectBlueprintTooltip(snapshot, target.id);
    case 'tool':
      return selectBuildToolTooltip(snapshot, target.id);
  }
}

function selectSpellTooltip(snapshot: Snapshot, spellId: string): UiTooltipContent | null {
  const spell = getSpell(spellId);
  if (!spell || spell.autoCast) return null;

  const { game } = snapshot;
  const inAttack = game.scene === 'run' && game.phase === 'attack';
  const hotkey = listHotbarSpells(game).findIndex((s) => s.id === spellId) + 1;
  const stats: UiTooltipStat[] = [
    { label: 'Mana', value: String(spell.manaCost), accent: true },
    { label: 'Cooldown', value: `${spell.cooldown}s` },
    { label: 'Range', value: `${spell.range} cells` },
    { label: 'Damage', value: String(spell.damage) },
  ];

  if (spell.id === 'blizzard') {
    stats.push({ label: 'Area', value: 'Diamond, radius 2' });
  } else if (spell.aoeRadius != null && spell.aoeRadius > 0) {
    const size = spell.aoeRadius * 2 + 1;
    stats.push({ label: 'Area', value: `${size}×${size} blast` });
  }

  stats.push({ label: 'Targeting', value: 'Click grid cell' });

  let footer: string | undefined;
  if (!inAttack) {
    footer = 'Available during attack · mana refills each wave';
  } else if (spellCooldownRemaining(game, spellId) > 0) {
    footer = `On cooldown (${spellCooldownRemaining(game, spellId).toFixed(1)}s)`;
  } else if (game.player.mana < spell.manaCost) {
    footer = 'Not enough mana';
  } else if (hotkey > 0) {
    footer = `Press ${hotkey} or click slot, then click the grid to cast`;
  }

  return {
    title: spell.name,
    glyph: spell.glyph,
    glyphColor: '#f6ad55',
    description: spell.description,
    stats,
    footer,
  };
}

function selectBlueprintTooltip(snapshot: Snapshot, blueprintId: string): UiTooltipContent | null {
  const blueprint = getBlueprint(blueprintId);
  if (!blueprint) return null;

  const { remainingGold } = selectBuildEconomy(snapshot);
  const affordable = remainingGold >= blueprint.cost;
  const behavior = getRoomBehavior(blueprintId);
  const stats: UiTooltipStat[] = [
    { label: 'Cost', value: `${blueprint.cost} gold`, accent: true },
    { label: 'HP', value: String(blueprint.baseHp) },
    { label: 'Size', value: `${blueprint.size.w}×${blueprint.size.h}` },
    { label: 'Affordable', value: affordable ? 'Yes' : 'No' },
  ];
  if (behavior) {
    stats.push({ label: 'Effect', value: behavior.mechanics, accent: true });
  }

  return {
    title: blueprint.name,
    glyph: blueprint.glyph,
    glyphColor: blueprint.color,
    description: blueprint.description,
    stats,
    footer: affordable ? 'Click to select · drag to place' : 'Not enough gold remaining',
  };
}

function selectBuildToolTooltip(snapshot: Snapshot, toolId: string): UiTooltipContent | null {
  const tool = getBuildTool(toolId);
  if (!tool) return null;

  const inSelect = snapshot.view.selectedBlueprintId === null;

  return {
    title: tool.name,
    glyph: tool.glyph,
    description: tool.description,
    stats: [{ label: 'Mode', value: inSelect ? 'Active' : 'Inactive', accent: inSelect }],
    footer: 'Click to enter select mode',
  };
}
