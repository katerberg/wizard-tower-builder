import {
  HARVEST_REPAIR_TAX,
  RAID_VERTICAL_BAND,
  isRaidEconomyBlueprint,
} from '@/config/raid';
import { roomCells } from '@/calculations/grid';
import { randomInt } from '@/calculations/rng';
import { macroCellOfNode } from '@/calculations/subGrid';
import { isExteriorFramingCell } from '@/model/fortifications/shell';
import { addMessage } from '@/model/messages';
import { clearFortify, isFortified } from '@/model/spells/earth/fortify';
import { getStorageSite, withdrawFromStorage } from '@/model/storage';
import { structureAt } from '@/model/tower/query';
import type { Cell, Enemy, GameState, RaidGoal, Room } from '@/model/types';

export function collectorIsBroken(state: GameState): boolean {
  return state.solarCollector.hp <= 0;
}

export function clearEnemyPathsForRaid(state: GameState): void {
  for (const enemy of state.enemies) {
    enemy.path = [];
    enemy.pathIndex = 0;
    enemy.pathGoalKey = undefined;
    enemy.raidGoal = null;
  }
}

/** Transition into RAID when collector HP first hits 0. Does not end the run. */
export function breakSolarCollector(state: GameState): void {
  state.solarCollector.hp = 0;
  if (state.collectorBrokeThisNight) return;
  state.collectorBrokeThisNight = true;
  state.collectorBrokeThisWave = true;
  if (isFortified(state)) {
    clearFortify(state, 'Fortify fades — the solar collector is gone.');
  }
  clearEnemyPathsForRaid(state);
  addMessage(state, 'The solar collector shatters — the tower is under RAID.', 'combat');
}

export function applyCollectorDamage(state: GameState, dealt: number): void {
  if (dealt <= 0 || collectorIsBroken(state)) return;
  state.solarCollector.hp = Math.max(0, state.solarCollector.hp - dealt);
  if (state.solarCollector.hp <= 0) {
    breakSolarCollector(state);
  }
}

/** Dawn: restore collector after a break and arm (or clear) the harvest repair tax. */
export function resolveCollectorDawn(state: GameState): void {
  if (state.harvestRepairTaxActive) {
    state.harvestRepairTaxActive = false;
  }
  if (state.collectorBrokeThisNight) {
    state.solarCollector.hp = state.solarCollector.maxHp;
    state.collectorBrokeThisNight = false;
    state.harvestRepairTaxActive = true;
    addMessage(
      state,
      'The solar collector is restored. Laborers pay a 50% harvest tax tonight for repairs.',
      'economy',
    );
  }
}

export function applyHarvestRepairTax(
  stone: number,
  metal: number,
  gold: number,
  taxActive: boolean,
): { stone: number; metal: number; gold: number } {
  if (!taxActive) return { stone, metal, gold };
  return {
    stone: stone * HARVEST_REPAIR_TAX,
    metal: metal * HARVEST_REPAIR_TAX,
    gold: gold * HARVEST_REPAIR_TAX,
  };
}

export function noteEnemyDamagedByRoom(enemy: Enemy, roomId: string): void {
  enemy.lastDamageSource = { roomId };
}

function roomAnchorRow(room: Room): number {
  return room.origin.row + Math.floor(room.size.h / 2);
}

function withinVerticalBand(enemy: Enemy, targetRow: number): boolean {
  return Math.abs(macroCellOfNode(enemy.pos).row - targetRow) <= RAID_VERTICAL_BAND;
}

function manhattanToRoom(enemy: Enemy, room: Room): number {
  const em = macroCellOfNode(enemy.pos);
  let best = Infinity;
  for (const cell of roomCells(room.origin, room.size)) {
    const d = Math.abs(em.col - cell.col) + Math.abs(em.row - cell.row);
    if (d < best) best = d;
  }
  return best;
}

function pickLastHitterGoal(state: GameState, enemy: Enemy): RaidGoal | null {
  const src = enemy.lastDamageSource;
  if (!src) return null;
  const room = state.tower.rooms.find((r) => r.id === src.roomId);
  if (!room) {
    enemy.lastDamageSource = null;
    return null;
  }
  if (!withinVerticalBand(enemy, roomAnchorRow(room))) return null;
  return { kind: 'room', roomId: room.id };
}

function pickEconomyGoal(state: GameState, enemy: Enemy): RaidGoal | null {
  let best: Room | null = null;
  let bestDist = Infinity;
  for (const room of state.tower.rooms) {
    if (!isRaidEconomyBlueprint(room.blueprintId)) continue;
    if (!withinVerticalBand(enemy, roomAnchorRow(room))) continue;
    const d = manhattanToRoom(enemy, room);
    if (d < bestDist) {
      bestDist = d;
      best = room;
    }
  }
  return best ? { kind: 'room', roomId: best.id } : null;
}

function pickRandomFramingGoal(state: GameState): RaidGoal | null {
  const cells: Cell[] = [];
  for (const structure of state.tower.structures) {
    for (const cell of roomCells(structure.origin, structure.size)) {
      if (isExteriorFramingCell(state.tower, cell.col, cell.row)) {
        cells.push({ col: cell.col, row: cell.row });
      }
    }
  }
  if (cells.length === 0) return null;
  const roll = randomInt(state.rngState, 0, cells.length - 1);
  state.rngState = roll.state;
  return { kind: 'framing', cell: cells[roll.value] };
}

function goalStillValid(state: GameState, enemy: Enemy, goal: RaidGoal): boolean {
  if (goal.kind === 'room') {
    const room = state.tower.rooms.find((r) => r.id === goal.roomId);
    if (!room) return false;
    return withinVerticalBand(enemy, roomAnchorRow(room));
  }
  return Boolean(structureAt(state.tower, goal.cell.col, goal.cell.row));
}

/** Priority: last hitter in band → economy in band → random exterior framing. */
export function pickRaidGoal(state: GameState, enemy: Enemy): RaidGoal | null {
  const last = pickLastHitterGoal(state, enemy);
  if (last) return last;

  if (enemy.raidGoal && goalStillValid(state, enemy, enemy.raidGoal)) {
    if (enemy.raidGoal.kind === 'room') {
      const sticky = enemy.raidGoal;
      const room = state.tower.rooms.find((r) => r.id === sticky.roomId);
      if (room && isRaidEconomyBlueprint(room.blueprintId)) return sticky;
    } else {
      return enemy.raidGoal;
    }
  }

  const economy = pickEconomyGoal(state, enemy);
  if (economy) return economy;
  return pickRandomFramingGoal(state);
}

export function stealFromStorageRoom(state: GameState, room: Room, dealt: number): void {
  if (room.blueprintId !== 'storageRoom' || dealt <= 0) return;
  const site = getStorageSite(state, room.id);
  if (!site) return;
  let remaining = dealt;
  const stoneTake = Math.min(remaining, site.stockpile.stone);
  remaining -= stoneTake;
  const metalTake = Math.min(remaining, site.stockpile.metal);
  const taken = withdrawFromStorage(site, { stone: stoneTake, metal: metalTake });
  if (taken.stone > 0 || taken.metal > 0) {
    const parts: string[] = [];
    if (taken.stone > 0) parts.push(`${taken.stone} stone`);
    if (taken.metal > 0) parts.push(`${taken.metal} metal`);
    addMessage(state, `Raiders loot ${parts.join(' and ')}!`, 'economy');
  }
}

export function countStorageRooms(state: GameState): number {
  return state.tower.rooms.filter((r) => r.blueprintId === 'storageRoom').length;
}

/** After any room removal: drop storage site bookkeeping and lose if no storage remains. */
export function afterRoomRemovedCheckStorageLose(
  state: GameState,
  roomId: string,
  blueprintId: string,
): void {
  if (blueprintId === 'storageRoom') {
    delete state.storageSites[roomId];
  }
  if (countStorageRooms(state) === 0) {
    state.scene = 'gameOver';
    addMessage(state, 'Every storage room is destroyed. The tower is overrun.', 'combat');
  }
}

export function nearestRoomCell(enemy: Enemy, room: Room): Cell {
  const em = macroCellOfNode(enemy.pos);
  let target = room.origin;
  let best = Infinity;
  for (const cell of roomCells(room.origin, room.size)) {
    const d = Math.abs(em.col - cell.col) + Math.abs(em.row - cell.row);
    if (d < best) {
      best = d;
      target = cell;
    }
  }
  return target;
}

export function enemyTouchesRoom(enemy: Enemy, room: Room): boolean {
  for (const cell of roomCells(room.origin, room.size)) {
    const em = macroCellOfNode(enemy.pos);
    if (Math.abs(em.col - cell.col) + Math.abs(em.row - cell.row) <= 1) return true;
  }
  return false;
}
