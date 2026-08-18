import {
  GRID_COLS,
  MINE_SHALLOW_DEPTH,
  MINE_STONE_PATCH_UNITS,
  PROSPECT_QUALITY_WEIGHTS,
  PROSPECT_WORK_TIME_BASE,
  PROSPECT_WORK_TIME_PER_DEPTH,
} from '@/config/constants';
import { cellKey } from '@/calculations/grid';
import { nextRandom } from '@/calculations/rng';
import type { Cell, MinePatch, MineState, Tower } from '@/model/types';

const PATCH_PREFIX = 'mine:patch:';
export const PROSPECT_TARGET = 'mine:prospect';

export function isProspectTarget(id: string | null | undefined): boolean {
  return id === PROSPECT_TARGET;
}

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

  return { entrance, tunnels, patches, unlockedDepth: 1 };
}

/** Quality band labels for prospect rolls. */
export type QualityBand = 'poor' | 'mixed' | 'rich';

/** Roll a quality band using the RNG stream. */
export function rollQualityBand(rngState: number): { band: QualityBand; rngState: number } {
  const { value, state: nextState } = nextRandom(rngState);
  const cum = PROSPECT_QUALITY_WEIGHTS;
  if (value < cum[0]) return { band: 'poor', rngState: nextState };
  if (value < cum[0] + cum[1]) return { band: 'mixed', rngState: nextState };
  return { band: 'rich', rngState: nextState };
}

/** Units per deep patch (scaled by quality). */
function deepPatchUnits(band: QualityBand): number {
  switch (band) {
    case 'poor': return Math.round(MINE_STONE_PATCH_UNITS * 0.6);
    case 'mixed': return MINE_STONE_PATCH_UNITS;
    case 'rich': return Math.round(MINE_STONE_PATCH_UNITS * 1.4);
  }
}

/**
 * Append the next depth tier (tunnels + patches) to an existing mine.
 * Called once per prospect resolve. Deterministic layout from entranceCol + depth index.
 */
export function generateDeepTier(
  mine: MineState,
  tower: Tower,
  rngState: number,
): { mine: MineState; rngState: number; band: QualityBand } {
  const nextDepth = mine.unlockedDepth + 1;
  const entranceCol = pickMineEntranceCol(tower);
  const tunnels = { ...mine.tunnels };
  const patches: MinePatch[] = [...mine.patches];
  let patchSerial = mine.patches.length;

  // Roll quality for this tier.
  const { band, rngState: rngAfterBand } = rollQualityBand(rngState);

  // Determine how many rows this tier spans.
  const tierStartRow = -(MINE_SHALLOW_DEPTH + (nextDepth - 1) * 2);
  const tierEndRow = tierStartRow - 1; // one row deeper

  // Advance RNG through each patch roll so the stream is deterministic.
  let rng = rngAfterBand;

  for (let row = tierStartRow; row >= tierEndRow; row--) {
    addTunnel(tunnels, entranceCol, row);

    // Side tunnels + patches on each row.
    for (const dcol of [-1, 1] as const) {
      const col = entranceCol + dcol;
      if (col < 0 || col >= GRID_COLS) continue;
      addTunnel(tunnels, col, row);

      // Decide resource type based on quality band.
      let resource: MinePatch['resource'] = 'stone';
      const roll = nextRandom(rng);
      rng = roll.state;

      if (band === 'poor') {
        // Mostly stone; rare metal.
        if (roll.value < 0.1) resource = 'metal';
      } else if (band === 'mixed') {
        // Mix of stone and metal, occasional gold.
        if (roll.value < 0.3) resource = 'gold';
        else if (roll.value < 0.7) resource = 'metal';
      } else {
        // Rich: metal dominant, frequent gold.
        if (roll.value < 0.4) resource = 'gold';
        else resource = 'metal';
      }

      patchSerial += 1;
      patches.push({
        id: `${resource}-${patchSerial}`,
        cell: { col, row },
        resource,
        remaining: deepPatchUnits(band),
      });
    }
  }

  // Connect from the previous deepest tunnel to this tier's shaft.
  const prevDeepestRow = -(MINE_SHALLOW_DEPTH + (nextDepth - 2) * 2);
  for (let r = prevDeepestRow - 1; r >= tierStartRow; r--) {
    addTunnel(tunnels, entranceCol, r);
  }

  return {
    mine: { ...mine, tunnels, patches, unlockedDepth: nextDepth },
    rngState: rng,
    band,
  };
}

/** Prospect work time in seconds, scaling with depth. */
export function getProspectWorkTime(depth: number): number {
  return PROSPECT_WORK_TIME_BASE + (depth - 1) * PROSPECT_WORK_TIME_PER_DEPTH;
}

/** Format the quality band into a human-readable prospect note. */
export function formatProspectNote(depth: number, band: QualityBand): string {
  const labels: Record<QualityBand, string> = {
    poor: 'mostly stone',
    mixed: 'mixed iron veins',
    rich: 'rich veins — iron and gems',
  };
  return `Discovered depth ${depth} — ${labels[band]}`;
}
