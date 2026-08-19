import { addResources } from '@/calculations/resources';
import { GRID_COLS } from '@/config/constants';
import { createInitialState } from '@/model/game';
import { framingHeight } from '@/model/phases';
import { hasStructure, towerExtents } from '@/model/tower';
import { parseKey } from '@/calculations/grid';
import { infraBlueprintIdForKind } from '@/model/infraBlueprints';
import { Store } from '@/store/store';
import { completeConstruction } from '@/test/construction';
import type { BalanceBuild, BlueprintPlacement, RecruitSpec, SlotAllocationSpec } from '@/test/balance/types';
import type { GameState } from '@/model/types';

/**
 * Diff the current game state against a fresh state created with the same seed,
 * producing a BalanceBuild-compatible object that can be serialized to JSON.
 *
 * Only captures build-phase-relevant state: tower layout (rooms, structures,
 * infra, shell), staff allocations, and research unlocks.
 */
export function extractFixtureFromState(
  game: GameState,
  sessionSeed: string | number,
): Omit<BalanceBuild, 'id' | 'title' | 'expect'> {
  const baseline = createInitialState(sessionSeed);
  const currentTower = game.tower;
  const baselineTower = baseline.tower;

  const placements: BlueprintPlacement[] = [];
  const placedKeys = new Set<string>();

  // Diff rooms
  for (const room of currentTower.rooms) {
    const baselineRoom = baselineTower.rooms.find(
      (br) =>
        br.blueprintId === room.blueprintId &&
        br.origin.col === room.origin.col &&
        br.origin.row === room.origin.row,
    );
    if (!baselineRoom) {
      const key = `room-${room.origin.col},${room.origin.row}`;
      if (!placedKeys.has(key)) {
        placements.push({ blueprintId: room.blueprintId, cell: { col: room.origin.col, row: room.origin.row } });
        placedKeys.add(key);
      }
    }
  }

  // Diff structures
  for (const structure of currentTower.structures) {
    const baselineStructure = baselineTower.structures.find(
      (bs) =>
        bs.blueprintId === structure.blueprintId &&
        bs.origin.col === structure.origin.col &&
        bs.origin.row === structure.origin.row,
    );
    if (!baselineStructure) {
      const key = `struct-${structure.origin.col},${structure.origin.row}`;
      if (!placedKeys.has(key)) {
        placements.push({ blueprintId: structure.blueprintId, cell: { col: structure.origin.col, row: structure.origin.row } });
        placedKeys.add(key);
      }
    }
  }

  // Diff infra
  for (const [key, infraCell] of Object.entries(currentTower.infra)) {
    const baselineInfra = baselineTower.infra[key];
    if (!baselineInfra?.kind || baselineInfra.kind !== infraCell.kind) {
      const { col, row } = parseKey(key);
      const blueprintId = infraBlueprintIdForKind(infraCell.kind);
      const pKey = `infra-${col},${row}`;
      if (!placedKeys.has(pKey)) {
        placements.push({ blueprintId, cell: { col, row } });
        placedKeys.add(pKey);
      }
    }
  }

  // Diff shell (fortifications)
  for (const [key, shellCell] of Object.entries(currentTower.shell ?? {})) {
    const baselineShell = baselineTower.shell?.[key];
    if (!baselineShell?.kind || baselineShell.kind !== shellCell.kind) {
      const { col, row } = parseKey(key);
      const pKey = `shell-${col},${row}`;
      if (!placedKeys.has(pKey)) {
        placements.push({ blueprintId: shellCell.kind, cell: { col, row } });
        placedKeys.add(pKey);
      }
    }
  }

  // Recruits
  const recruits: RecruitSpec[] = [];
  for (const [roomId, count] of Object.entries(game.housingRecruited)) {
    if (count <= 0) continue;
    const room = currentTower.rooms.find((r) => r.id === roomId);
    if (!room) continue;
    const baselineRecruited = baseline.housingRecruited[roomId] ?? 0;
    const extra = count - baselineRecruited;
    if (extra > 0) {
      recruits.push({ cell: { col: room.origin.col, row: room.origin.row }, extra });
    }
    else if (baselineRecruited === undefined && count > 0) {
      recruits.push({ cell: { col: room.origin.col, row: room.origin.row }, extra: count });
    }
  }

  // Slot allocations
  const slotAllocations: SlotAllocationSpec[] = [];
  for (const [roomId, count] of Object.entries(game.slotAllocations)) {
    if (count <= 0) continue;
    const room = currentTower.rooms.find((r) => r.id === roomId);
    if (!room) continue;
    const baselineAlloc = baseline.slotAllocations[roomId] ?? 0;
    if (count > baselineAlloc) {
      slotAllocations.push({ cell: { col: room.origin.col, row: room.origin.row }, count });
    }
  }

  // Research: nodes completed in current but not in baseline
  const baselineCompleted = new Set(baseline.player.research.completedNodeIds);
  const research = game.player.research.completedNodeIds.filter((id) => !baselineCompleted.has(id));

  // Height from tower extents
  const height = towerExtents(currentTower).maxOccupiedRow;

  return {
    placements,
    recruits: recruits.length > 0 ? recruits : undefined,
    slotAllocations: slotAllocations.length > 0 ? slotAllocations : undefined,
    research: research.length > 0 ? research : undefined,
    seeds: ['first-wave-b'],
    height,
  };
}

/**
 * Build a fresh GameState from a BalanceBuild fixture by running it through
 * a temporary Store with the fixed seed 'first-wave-b'.
 * Reuses the existing dispatch-based placement path for correctness.
 */
export function applyFixtureToState(fixture: BalanceBuild): GameState {
  const store = new Store('first-wave-b');

  // Overlay wallet
  if (fixture.wallet) {
    const game = store.getSnapshot().game;
    game.player.resources = addResources(game.player.resources, fixture.wallet);
  }

  // Raise to height
  raiseToHeightViaStore(store, fixture.height);

  // Grant research
  if (fixture.research && fixture.research.length > 0) {
    grantResearchViaStore(store, fixture.research);
  }

  // Placements
  for (const placement of fixture.placements ?? []) {
    placeViaStore(store, placement);
  }

  // Recruits
  for (const recruit of fixture.recruits ?? []) {
    for (let i = 0; i < recruit.extra; i++) {
      recruitViaStore(store, recruit.cell);
    }
  }

  // Slot allocations
  for (const slot of fixture.slotAllocations ?? []) {
    allocateSlotViaStore(store, slot);
  }

  return store.getSnapshot().game;
}

/* ---- Store-based helpers (reuse existing dispatch logic) ---- */

function raiseToHeightViaStore(store: Store, target: number): void {
  const current = framingHeight(store.getSnapshot().game);
  if (current >= target) return;
  const col = findGrowColumn(store);
  for (let row = current + 1; row <= target; row++) {
    placeViaStore(store, { blueprintId: 'stem', cell: { col, row } });
  }
}

function grantResearchViaStore(store: Store, nodeIds: readonly string[]): void {
  const game = store.getSnapshot().game;
  const wasDev = game.devMode;
  if (!wasDev) store.dispatch({ type: 'toggleDevMode' });
  for (const nodeId of nodeIds) {
    store.dispatch({ type: 'devUnlockResearch', nodeId });
  }
  if (!wasDev) store.dispatch({ type: 'toggleDevMode' });
}

function placeViaStore(store: Store, placement: BlueprintPlacement): void {
  store.dispatch({ type: 'selectBlueprint', blueprintId: placement.blueprintId });
  store.dispatch({ type: 'placeSelectedAt', cell: placement.cell });
  completeConstruction(store);
}

function recruitViaStore(store: Store, cell: { col: number; row: number }): void {
  const roomId = findRoomIdAt(store, cell);
  store.dispatch({ type: 'recruitStaff', housingRoomId: roomId });
}

function allocateSlotViaStore(store: Store, spec: SlotAllocationSpec): void {
  const roomId = findRoomIdAt(store, spec.cell);
  store.dispatch({ type: 'setSlotAllocation', slotRoomId: roomId, count: spec.count });
}

function findRoomIdAt(store: Store, cell: { col: number; row: number }): string {
  const room = store.getSnapshot().game.tower.rooms.find(
    (c) => c.origin.col === cell.col && c.origin.row === cell.row,
  );
  if (!room) throw new Error(`No room at (${cell.col}, ${cell.row}) for fixture load.`);
  return room.id;
}

function findGrowColumn(store: Store): number {
  const tower = store.getSnapshot().game.tower;
  const { maxOccupiedRow } = towerExtents(tower);
  const preferred = [6, 7, 8];
  for (const col of preferred) {
    if (hasStructure(tower, col, maxOccupiedRow)) return col;
  }
  for (let col = 0; col < GRID_COLS; col++) {
    if (hasStructure(tower, col, maxOccupiedRow)) return col;
  }
  return 6;
}
