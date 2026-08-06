import {
  BARBICAN_BAND_STEP_COST,
  CORNICE_SLOW_MULT,
  CORNICE_STEP_COST,
  FORT_SLOW_CAP_MULT,
  GLACIS_STEP_COST,
  MOAT_SLOW_MULT,
  MOAT_STEP_COST,
  PARAPET_SLOW_MULT,
  PARAPET_STEP_COST,
  STAKES_SLOW_MULT,
  STAKES_STEP_COST,
} from '@/config/fortifications';
import { macroCol, macroRow } from '@/calculations/subGrid';
import { hasStructure } from '@/model/tower/query';
import type { ExteriorNode, MovementProfile, Tower } from '@/model/types';
import { shellKindAt } from './shell';

function hasFramingAtSub(tower: Tower, subCol: number, subRow: number): boolean {
  if (subRow < 0) return false;
  return hasStructure(tower, macroCol(subCol), macroRow(subRow));
}

const ORTHO_MACRO = [
  { dc: 1, dr: 0 },
  { dc: -1, dr: 0 },
  { dc: 0, dr: 1 },
  { dc: 0, dr: -1 },
];

/** Empty ground macros orthogonally adjacent to a ground-row fortification host. */
export function groundAuraMacros(tower: Tower, hostCol: number, hostRow: number): { col: number; row: number }[] {
  if (hostRow !== 0) return [];
  const out: { col: number; row: number }[] = [];
  for (const { dc, dr } of ORTHO_MACRO) {
    const col = hostCol + dc;
    const row = hostRow + dr;
    if (row !== 0) continue;
    if (hasStructure(tower, col, row)) continue;
    out.push({ col, row });
  }
  return out;
}

function hostsOfKindNearGround(
  tower: Tower,
  macroCol: number,
  macroRow: number,
  kinds: ReadonlySet<string>,
): boolean {
  if (macroRow !== 0) return false;
  for (const { dc, dr } of ORTHO_MACRO) {
    const hc = macroCol + dc;
    const hr = macroRow + dr;
    if (hr !== 0) continue;
    const kind = shellKindAt(tower, hc, hr);
    if (kind && kinds.has(kind)) return true;
  }
  return false;
}

const MOAT = new Set(['moat']);
const GLACIS = new Set(['glacis']);
const STAKES = new Set(['stakes']);

/** True when this empty ground sub-cell is in a moat aura. */
export function isOnMoatAura(tower: Tower, subCol: number, subRow: number): boolean {
  if (subRow !== 0) return false;
  const mc = macroCol(subCol);
  const mr = macroRow(subRow);
  if (hasStructure(tower, mc, mr)) return false;
  return hostsOfKindNearGround(tower, mc, mr, MOAT);
}

/** Soft ground costs from moat / glacis / stakes auras (max wins). */
export function groundAuraStepCost(tower: Tower, subCol: number, subRow: number): number {
  if (subRow !== 0) return 1;
  const mc = macroCol(subCol);
  const mr = macroRow(subRow);
  if (hasStructure(tower, mc, mr)) return 1;
  let cost = 1;
  if (hostsOfKindNearGround(tower, mc, mr, MOAT)) cost = Math.max(cost, MOAT_STEP_COST);
  if (hostsOfKindNearGround(tower, mc, mr, GLACIS)) cost = Math.max(cost, GLACIS_STEP_COST);
  if (hostsOfKindNearGround(tower, mc, mr, STAKES)) cost = Math.max(cost, STAKES_STEP_COST);
  return cost;
}

export function isOnStakesAura(tower: Tower, subCol: number, subRow: number): boolean {
  if (subRow !== 0) return false;
  const mc = macroCol(subCol);
  const mr = macroRow(subRow);
  if (hasStructure(tower, mc, mr)) return false;
  return hostsOfKindNearGround(tower, mc, mr, STAKES);
}

/** True when walk cell's onTop contact is against a parapet host. */
export function isOnParapetTop(tower: Tower, subCol: number, subRow: number): boolean {
  if (!hasFramingAtSub(tower, subCol, subRow - 1)) return false;
  const mc = macroCol(subCol);
  const hostRow = macroRow(subRow - 1);
  return shellKindAt(tower, mc, hostRow) === 'parapet';
}

/** True when walk cell's underCeiling contact is against a cornice host. */
export function isOnCorniceUnder(tower: Tower, subCol: number, subRow: number): boolean {
  if (!hasFramingAtSub(tower, subCol, subRow + 1)) return false;
  const mc = macroCol(subCol);
  const hostRow = macroRow(subRow + 1);
  return shellKindAt(tower, mc, hostRow) === 'cornice';
}

function parapetStepCost(tower: Tower, subCol: number, subRow: number): number {
  return isOnParapetTop(tower, subCol, subRow) ? PARAPET_STEP_COST : 1;
}

function corniceStepCost(tower: Tower, subCol: number, subRow: number): number {
  return isOnCorniceUnder(tower, subCol, subRow) ? CORNICE_STEP_COST : 1;
}

/**
 * Barbican band: high cost on nearby exterior walk nodes along the host's wall face,
 * except nodes on the barbican cell's own exposed face (cost 1).
 */
export function barbicanStepCost(tower: Tower, subCol: number, subRow: number): number {
  const walkMc = macroCol(subCol);
  const walkMr = macroRow(subRow);
  let best = 1;

  for (const [key, cell] of Object.entries(tower.shell ?? {})) {
    if (cell.kind !== 'barbican') continue;
    const [hcStr, hrStr] = key.split(',');
    const hc = Number(hcStr);
    const hr = Number(hrStr);

    const leftOpen = !hasStructure(tower, hc - 1, hr);
    const rightOpen = !hasStructure(tower, hc + 1, hr);
    if (!leftOpen && !rightOpen) continue;

    // Gate faces: empty macros beside the host.
    const onLeftGate = leftOpen && walkMc === hc - 1 && walkMr === hr;
    const onRightGate = rightOpen && walkMc === hc + 1 && walkMr === hr;
    if (onLeftGate || onRightGate) {
      best = Math.max(best, 1);
      continue;
    }

    // Band: same column as a gate face, within ±1 macro row of host, empty of framing.
    const inLeftBand =
      leftOpen && walkMc === hc - 1 && Math.abs(walkMr - hr) <= 1 && !hasStructure(tower, walkMc, walkMr);
    const inRightBand =
      rightOpen && walkMc === hc + 1 && Math.abs(walkMr - hr) <= 1 && !hasStructure(tower, walkMc, walkMr);
    if (inLeftBand || inRightBand) {
      best = Math.max(best, BARBICAN_BAND_STEP_COST);
    }
  }

  return best;
}

/**
 * A* step cost for entering `node`. Fliers always pay 1.
 * All fortifications are soft funnel / time tax — none remove walkability.
 */
export function stepCost(tower: Tower, node: ExteriorNode, profile: MovementProfile): number {
  if (profile.canFly) return 1;
  const ground = groundAuraStepCost(tower, node.col, node.row);
  const barb = barbicanStepCost(tower, node.col, node.row);
  const parapet = parapetStepCost(tower, node.col, node.row);
  const cornice = corniceStepCost(tower, node.col, node.row);
  return Math.max(ground, barb, parapet, cornice);
}

/**
 * Move-cooldown multiplier from fortifications on `enemyPos`.
 * Uses the strongest applicable fort slow, capped at 80% (`FORT_SLOW_CAP_MULT`).
 */
export function fortificationSlowMultiplier(
  tower: Tower,
  enemyPos: ExteriorNode,
  canFly: boolean,
): number {
  if (canFly) return 1;
  let mult = 1;
  if (isOnMoatAura(tower, enemyPos.col, enemyPos.row)) {
    mult = Math.max(mult, MOAT_SLOW_MULT);
  }
  if (isOnStakesAura(tower, enemyPos.col, enemyPos.row)) {
    mult = Math.max(mult, STAKES_SLOW_MULT);
  }
  if (isOnParapetTop(tower, enemyPos.col, enemyPos.row)) {
    mult = Math.max(mult, PARAPET_SLOW_MULT);
  }
  if (isOnCorniceUnder(tower, enemyPos.col, enemyPos.row)) {
    mult = Math.max(mult, CORNICE_SLOW_MULT);
  }
  return Math.min(mult, FORT_SLOW_CAP_MULT);
}
