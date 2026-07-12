import { cellKey, parseKey, roomCells } from '@/calculations/grid';
import type { Cell, Fluid, Tower } from '@/model/types';

/** Live or locked pipe fluid label. */
export type PipeFluid = Fluid;

const ORTHO: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export function isBoilerRoom(room: { blueprintId: string }): boolean {
  return room.blueprintId === 'boilerRoom';
}

function pipeCells(tower: Tower): Cell[] {
  const cells: Cell[] = [];
  for (const [key, cell] of Object.entries(tower.infra ?? {})) {
    if (cell.kind !== 'pipe') continue;
    cells.push(parseKey(key));
  }
  return cells;
}

function hasPipe(tower: Tower, col: number, row: number): boolean {
  return tower.infra[cellKey(col, row)]?.kind === 'pipe';
}

function boilerFootprintCells(tower: Tower): Cell[] {
  const cells: Cell[] = [];
  for (const room of tower.rooms) {
    if (!isBoilerRoom(room)) continue;
    cells.push(...roomCells(room.origin, room.size));
  }
  return cells;
}

export function isBoilerFootprintCell(tower: Tower, col: number, row: number): boolean {
  return boilerFootprintCells(tower).some((c) => c.col === col && c.row === row);
}

function flood(
  tower: Tower,
  seeds: Cell[],
  assign: Record<string, PipeFluid>,
  label: 'water' | 'steam',
): void {
  const queue = [...seeds];
  const seen = new Set<string>();
  for (const seed of queue) {
    seen.add(cellKey(seed.col, seed.row));
  }
  while (queue.length > 0) {
    const cur = queue.shift()!;
    assign[cellKey(cur.col, cur.row)] = label;
    for (const [dc, dr] of ORTHO) {
      const n = { col: cur.col + dc, row: cur.row + dr };
      const key = cellKey(n.col, n.row);
      if (seen.has(key) || !hasPipe(tower, n.col, n.row)) continue;
      seen.add(key);
      queue.push(n);
    }
  }
}

/**
 * Water: flood from row-0 pipes.
 * Steam (until P4 turrets): flood from pipes adjacent to boilers that are not water.
 */
export function selectPipeFluids(tower: Tower): Record<string, PipeFluid> {
  const result: Record<string, PipeFluid> = {};
  const pipes = pipeCells(tower);
  for (const c of pipes) {
    result[cellKey(c.col, c.row)] = 'unassigned';
  }

  const waterSeeds = pipes.filter((c) => c.row === 0);
  flood(tower, waterSeeds, result, 'water');

  const steamSeeds: Cell[] = [];
  for (const foot of boilerFootprintCells(tower)) {
    for (const [dc, dr] of ORTHO) {
      const n = { col: foot.col + dc, row: foot.row + dr };
      const key = cellKey(n.col, n.row);
      if (!hasPipe(tower, n.col, n.row)) continue;
      if (result[key] === 'water') continue;
      steamSeeds.push(n);
    }
  }
  flood(tower, steamSeeds, result, 'steam');

  return result;
}

/** Prefer locked fluid during attack; otherwise live topology. */
export function resolvePipeFluids(tower: Tower, phase: 'build' | 'attack'): Record<string, PipeFluid> {
  if (phase === 'attack') {
    const locked: Record<string, PipeFluid> = {};
    let anyLocked = false;
    for (const [key, cell] of Object.entries(tower.infra ?? {})) {
      if (cell.kind !== 'pipe') continue;
      if (cell.fluid) {
        locked[key] = cell.fluid;
        anyLocked = true;
      }
    }
    if (anyLocked) return locked;
  }
  return selectPipeFluids(tower);
}

export function pipeFluidAt(
  tower: Tower,
  col: number,
  row: number,
  phase: 'build' | 'attack' = 'build',
): PipeFluid {
  if (!hasPipe(tower, col, row)) return 'unassigned';
  return resolvePipeFluids(tower, phase)[cellKey(col, row)] ?? 'unassigned';
}

/** Preview fluid if a pipe were placed at `cell`. */
export function previewPipeFluidAt(tower: Tower, cell: Cell): PipeFluid {
  const probe: Tower = {
    ...tower,
    infra: { ...tower.infra, [cellKey(cell.col, cell.row)]: { kind: 'pipe' } },
  };
  return selectPipeFluids(probe)[cellKey(cell.col, cell.row)] ?? 'unassigned';
}

/**
 * True if placing a pipe at `cell` would 4-connect water and steam neighborhoods.
 */
export function wouldMixFluids(tower: Tower, cell: Cell): boolean {
  if (hasPipe(tower, cell.col, cell.row)) return false;
  const fluids = selectPipeFluids(tower);
  let touchesWater = cell.row === 0;
  let touchesSteam = false;

  for (const [dc, dr] of ORTHO) {
    const n = { col: cell.col + dc, row: cell.row + dr };
    if (!hasPipe(tower, n.col, n.row)) continue;
    const f = fluids[cellKey(n.col, n.row)];
    if (f === 'water') touchesWater = true;
    if (f === 'steam') touchesSteam = true;
  }

  return touchesWater && touchesSteam;
}

/** Write resolved fluids onto pipe cells (call at wave start). */
export function lockPipeFluids(tower: Tower): Tower {
  const fluids = selectPipeFluids(tower);
  const infra = { ...tower.infra };
  for (const [key, cell] of Object.entries(infra)) {
    if (cell.kind !== 'pipe') continue;
    infra[key] = { ...cell, fluid: fluids[key] ?? 'unassigned' };
  }
  return { ...tower, infra };
}

export function boilerHasWaterPort(
  tower: Tower,
  roomOrigin: Cell,
  roomSize: { w: number; h: number },
): boolean {
  const fluids = selectPipeFluids(tower);
  for (const c of roomCells(roomOrigin, roomSize)) {
    for (const [dc, dr] of ORTHO) {
      const n = { col: c.col + dc, row: c.row + dr };
      if (fluids[cellKey(n.col, n.row)] === 'water') return true;
    }
  }
  return false;
}

export function boilerHasSteamPort(
  tower: Tower,
  roomOrigin: Cell,
  roomSize: { w: number; h: number },
): boolean {
  const fluids = selectPipeFluids(tower);
  for (const c of roomCells(roomOrigin, roomSize)) {
    for (const [dc, dr] of ORTHO) {
      const n = { col: c.col + dc, row: c.row + dr };
      if (fluids[cellKey(n.col, n.row)] === 'steam') return true;
    }
  }
  return false;
}
