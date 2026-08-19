import {
  GROUND_WATER_MAX_ROW,
  HAND_PUMP_LABORER_RESERVE,
  HAND_PUMP_MAX_WATER_ROW,
  MINE_STONE_HARVEST_PER_SEC,
  PASSIVE_IRON_FRACTION,
  PUMP_WATER_ROW_EXTENSION,
  RARE_PATCH_FALLOFF,
} from '@/config/constants';
import { reward } from '@/calculations/economy';
import { depositToStorage, stockpileFromCost } from '@/model/storage';
import { findInteriorPath } from '@/calculations/interiorPathfinding';
import { cellDistance, roomAnchorCell } from '@/calculations/interiorGraph';
import {
  findMinePatchByTarget,
  formatProspectNote,
  generateDeepTier,
  isMinePatchTarget,
  minePatchTargetId,
} from '@/model/mines';
import { addMessage } from '@/model/messages';
import type { Cell, GameState, MinePatch, Resources, Room, StaffUnit, Tower } from '@/model/types';

const PUMP_TARGET = 'pump:hand';

/** Credit harvest to storage rooms; track wave haul for modal. */
function rewardHarvest(state: GameState, haul: Partial<Resources>, from?: Cell): void {
  const physical = stockpileFromCost(haul);
  if (physical.stone > 0 || physical.metal > 0) {
    const overflow = depositToStorage(state, physical, from);
    if (overflow.stone > 0 || overflow.metal > 0) {
      addMessage(state, 'Storage full — excess materials wasted.', 'economy');
    }
  }
  if (haul.gold && haul.gold > 0) {
    reward(state, { gold: haul.gold });
  }
  if (haul.stone) state.waveHaul.stone += haul.stone;
  if (haul.metal) state.waveHaul.metal += haul.metal;
  if (haul.gold) state.waveHaul.gold += haul.gold ?? 0;
}

export function isPumpTarget(id: string | null | undefined): boolean {
  return id === PUMP_TARGET;
}

/** @deprecated Use isMinePatchTarget — abstract underground harvest removed. */
export function isHarvestTarget(id: string | null | undefined): boolean {
  return isMinePatchTarget(id);
}

export function countPumpRooms(tower: Tower): number {
  return tower.rooms.filter((r) => r.blueprintId === 'pumpRoom').length;
}

function towerNeedsElevatedWater(tower: Tower): boolean {
  const needsWater = tower.rooms.some((r) =>
    ['boilerRoom', 'manaSpringRoom', 'hydrantRoom', 'steamTurretRoom', 'pumpRoom'].includes(
      r.blueprintId,
    ),
  );
  if (needsWater) return true;
  for (const [key, cell] of Object.entries(tower.infra ?? {})) {
    if (cell.kind !== 'pipe') continue;
    const row = Number(key.split(',')[1]);
    if (row > 0) return true;
  }
  return false;
}

export function handPumpReserveNeeded(state: GameState): number {
  return towerNeedsElevatedWater(state.tower) ? HAND_PUMP_LABORER_RESERVE : 0;
}

function recruitedLaborers(state: GameState): number {
  let n = 0;
  for (const room of state.tower.rooms) {
    if (room.blueprintId !== 'quartersRoom') continue;
    n += state.housingRecruited[room.id] ?? 0;
  }
  return n;
}

/**
 * Max pipe row that can carry water.
 * Build phase assumes roster can cover the hand-pump reserve; attack uses live pumpers.
 */
export function maxWaterReachRow(state: GameState): number {
  const pumps = countPumpRooms(state.tower);
  const livePumpers = state.staff.filter(
    (s) => s.kind === 'laborer' && isPumpTarget(s.targetWorkplaceId),
  ).length;
  const reserve = handPumpReserveNeeded(state);

  if (state.phase === 'day') {
    const canHand = reserve > 0 && recruitedLaborers(state) >= reserve;
    if (!canHand && pumps <= 0) return GROUND_WATER_MAX_ROW;
    const base = canHand || pumps > 0 ? HAND_PUMP_MAX_WATER_ROW : GROUND_WATER_MAX_ROW;
    return base + pumps * PUMP_WATER_ROW_EXTENSION;
  }

  // Attack: mechanical pumps lift from ground; hand band needs a live pumper.
  if (livePumpers <= 0 && pumps <= 0) return GROUND_WATER_MAX_ROW;
  if (livePumpers <= 0) return GROUND_WATER_MAX_ROW + pumps * PUMP_WATER_ROW_EXTENSION;
  return HAND_PUMP_MAX_WATER_ROW + pumps * PUMP_WATER_ROW_EXTENSION;
}

/** Ground-row cell above the mine entrance (hand-pump station / mine access). */
export function groundPumpAnchor(state: GameState): Cell {
  const entrance = state.mine.entrance;
  return { col: entrance.col, row: 0 };
}

/**
 * True when a cell can path to the ground mine entrance (stairs/elevators for vertical tower travel).
 */
export function canPathToMineEntrance(state: GameState, from: Cell): boolean {
  const goal = groundPumpAnchor(state);
  if (from.col === goal.col && from.row === goal.row) return true;
  return findInteriorPath(state.tower, from, goal, state.mine).length > 0;
}

/** Quarters must reach ground framing at the mine entrance to send miners / pumpers. */
export function quartersCanReachMine(state: GameState, quarters: Room): boolean {
  const from = roomAnchorCell(state.tower, quarters.origin, quarters.size, state.mine);
  if (!from) return false;
  return canPathToMineEntrance(state, from);
}

function laborerCanReachMineJobs(state: GameState, unit: StaffUnit): boolean {
  return canPathToMineEntrance(state, unit.pos);
}

/** All mine patches with remaining units (stone, metal, gold). */
function availableMinePatches(state: GameState): MinePatch[] {
  return state.mine.patches.filter((p) => p.remaining > 0);
}

/**
 * Get the frontier cell for prospecting (deepest unlocked shaft tip).
 * Returns the entrance cell if no deep tiers unlocked.
 */
export function prospectFrontierCell(state: GameState): Cell {
  const mine = state.mine;
  // Find the deepest tunnel in the entrance column.
  let deepestRow = mine.entrance.row;
  for (const key of Object.keys(mine.tunnels)) {
    const [col, row] = key.split(',').map(Number);
    if (col === mine.entrance.col && row < deepestRow) {
      deepestRow = row;
    }
  }
  return { col: mine.entrance.col, row: deepestRow };
}

/** Assign idle laborers to pump (reserve) then available mine patches (stone, metal, gold). Call after repair. */
export function assignSurplusLaborers(state: GameState): void {
  const idle = state.staff.filter((s) => s.kind === 'laborer' && s.status === 'idle');
  if (idle.length === 0) return;

  const reserve = handPumpReserveNeeded(state);
  const currentPumpers = state.staff.filter(
    (s) => s.kind === 'laborer' && isPumpTarget(s.targetWorkplaceId),
  ).length;
  let needPump = Math.max(0, reserve - currentPumpers);
  const pumpAnchor = groundPumpAnchor(state);
  const patches = availableMinePatches(state);

  for (const unit of idle) {
    if (!laborerCanReachMineJobs(state, unit)) {
      // Stuck above without stairs/elevator — leave idle (repair may still claim them later).
      continue;
    }

    if (needPump > 0) {
      needPump -= 1;
      const path = findInteriorPath(state.tower, unit.pos, pumpAnchor, state.mine);
      unit.targetWorkplaceId = PUMP_TARGET;
      unit.path = path.length > 0 ? path : [unit.pos];
      unit.pathIndex = 0;
      const atAnchor =
        unit.pos.col === pumpAnchor.col && unit.pos.row === pumpAnchor.row && path.length <= 1;
      unit.status = atAnchor ? 'working' : 'moving';
      continue;
    }

    if (patches.length === 0) {
      continue;
    }

    // Prefer rare patches (metal/gold) over stone; within same type, nearest first.
    patches.sort((a, b) => {
      const rarityA = a.resource === 'stone' ? 0 : a.resource === 'metal' ? 1 : 2;
      const rarityB = b.resource === 'stone' ? 0 : b.resource === 'metal' ? 1 : 2;
      if (rarityA !== rarityB) return rarityB - rarityA; // higher rarity first
      const da = cellDistance(unit.pos, a.cell);
      const db = cellDistance(unit.pos, b.cell);
      if (da !== db) return da - db;
      return a.id.localeCompare(b.id);
    });
    const patch = patches[0];
    const path = findInteriorPath(state.tower, unit.pos, patch.cell, state.mine);
    if (path.length === 0) continue;
    unit.targetWorkplaceId = minePatchTargetId(patch.id);
    unit.path = path;
    unit.pathIndex = 0;
    const atPatch =
      unit.pos.col === patch.cell.col && unit.pos.row === patch.cell.row && path.length <= 1;
    unit.status = atPatch ? 'working' : 'moving';
  }
}

/**
 * Resolve the prospect job: generate the next deep tier and form the prospect note.
 * Called once per wave when prospect work time completes.
 */
export function resolveProspect(state: GameState): void {
  const { mine } = state;
  const { mine: newMine, rngState, band } = generateDeepTier(mine, state.tower, state.rngState);
  state.mine = newMine;
  state.rngState = rngState;

  const note = formatProspectNote(newMine.unlockedDepth, band);
  addMessage(state, note, 'economy');
}

/** Tick mine harvest and hand-pump for laborers (night only). */
export function tickLaborerHarvestAndPump(state: GameState, dt: number): void {
  if (state.phase !== 'night') return;

  for (const unit of state.staff) {
    if (unit.kind !== 'laborer' || unit.status !== 'working') continue;
    if (!isMinePatchTarget(unit.targetWorkplaceId)) continue;

    const patch = findMinePatchByTarget(state.mine, unit.targetWorkplaceId!);
    if (!patch || patch.remaining <= 0) {
      unit.targetWorkplaceId = null;
      unit.status = 'idle';
      unit.path = [unit.pos];
      unit.pathIndex = 0;
      continue;
    }
    if (unit.pos.col !== patch.cell.col || unit.pos.row !== patch.cell.row) continue;

    if (patch.resource === 'stone') {
      // Stone: unchanged rate; no falloff.
      const want = MINE_STONE_HARVEST_PER_SEC * dt;
      const gained = Math.min(want, patch.remaining);
      if (gained <= 0) continue;
      patch.remaining -= gained;
      rewardHarvest(state, { stone: gained }, patch.cell);
      const ironDrip = gained * PASSIVE_IRON_FRACTION;
      if (ironDrip > 0) {
        rewardHarvest(state, { metal: ironDrip }, patch.cell);
      }
    } else {
      // Metal / gold: diminishing returns per extra laborer on same patch.
      const laborersOnPatch = state.staff.filter(
        (s) =>
          s.kind === 'laborer' &&
          s.status === 'working' &&
          isMinePatchTarget(s.targetWorkplaceId) &&
          s.targetWorkplaceId === unit.targetWorkplaceId,
      );
      const index = laborersOnPatch.indexOf(unit);
      const multiplier = Math.pow(RARE_PATCH_FALLOFF, index);
      const want = MINE_STONE_HARVEST_PER_SEC * dt * multiplier;
      const gained = Math.min(want, patch.remaining);
      if (gained <= 0) continue;
      patch.remaining -= gained;
      if (patch.resource === 'gold') {
        rewardHarvest(state, { gold: gained }, patch.cell);
      } else {
        rewardHarvest(state, { metal: gained }, patch.cell);
      }
    }

    if (patch.remaining <= 0) {
      unit.targetWorkplaceId = null;
      unit.status = 'idle';
      unit.path = [unit.pos];
      unit.pathIndex = 0;
    }
  }
}
