import { GRID_COLS, MINE_SHALLOW_DEPTH, MINE_STONE_PATCH_UNITS } from '@/config/constants';
import { cellKey } from '@/calculations/grid';
import type { Cell, MinePatch, MineState, Tower } from '@/model/types';

const PATCH_PREFIX = 'mine:patch:';

export function minePatchTargetId(patchId: string): string {
  return `${PATCH_PREFIX}${patchId}`;
}

export function isMinePatchTarget(id: string | null | undefined): boolean {
  return typeof id === 'string' && id.startsWith(PATCH_PREFIX);
}

export function patchIdFromTarget(id: string): string | null {
  if (!isMinePatchTarget(id)) return null;
  return id.slice(PATCH_PREFIX.length);
}

export function isMineTunnel(mine: MineState | null | undefined, col: number, row: number): boolean {
  if (!mine) return false;
  return mine.tunnels[cellKey(col, row)] === true;
}

export function findMinePatch(mine: MineState, patchId: string): MinePatch | undefined {
  return mine.patches.find((p) => p.id === patchId);
}

export function findMinePatchByTarget(mine: MineState, targetId: string): MinePatch | undefined {
  const id = patchIdFromTarget(targetId);
  return id ? findMinePatch(mine, id) : undefined;
}

/** Prefer mid ground-row framing col (starter hollow at 7 when present). */
export function pickMineEntranceCol(tower: Tower): number {
  const groundCols = new Set<number>();
  for (const s of tower.structures ?? []) {
    for (let c = s.origin.col; c < s.origin.col + s.size.w; c++) {
      if (s.origin.row === 0) groundCols.add(c);
    }
  }
  if (groundCols.size === 0) return Math.floor(GRID_COLS / 2);
  const sorted = [...groundCols].sort((a, b) => a - b);
  if (sorted.includes(7)) return 7;
  return sorted[Math.floor(sorted.length / 2)];
}

function addTunnel(tunnels: Record<string, true>, col: number, row: number): void {
  if (col < 0 || col >= GRID_COLS) return;
  tunnels[cellKey(col, row)] = true;
}

/**
 * Deterministic shallow mine under ground framing.
 * Vertical shaft + side stone patches on deeper rows (no RNG).
 */
export function generateShallowMine(tower: Tower): MineState {
  const entranceCol = pickMineEntranceCol(tower);
  const entrance: Cell = { col: entranceCol, row: -1 };
  const tunnels: Record<string, true> = {};
  const patches: MinePatch[] = [];
  let patchSerial = 0;

  for (let depth = 1; depth <= MINE_SHALLOW_DEPTH; depth++) {
    const row = -depth;
    addTunnel(tunnels, entranceCol, row);

    if (depth < 2) continue;

    for (const dcol of [-1, 1] as const) {
      const col = entranceCol + dcol;
      if (col < 0 || col >= GRID_COLS) continue;
      addTunnel(tunnels, col, row);
      patchSerial += 1;
      const id = `stone-${patchSerial}`;
      patches.push({
        id,
        cell: { col, row },
        resource: 'stone',
        remaining: MINE_STONE_PATCH_UNITS,
      });
    }
  }

  // Ensure shaft cells exist even if depth config is 1.
  addTunnel(tunnels, entrance.col, entrance.row);

  return { entrance, tunnels, patches };
}
