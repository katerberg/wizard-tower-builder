import {
  BARBICAN_BAND_STEP_COST,
  GLACIS_STEP_COST,
  STAKES_SLOW_MULT,
  STAKES_STEP_COST,
} from '@/config/fortifications';
import { macroCol, macroRow } from '@/calculations/subGrid';
import { hasStructure } from '@/model/tower/query';
import type { ExteriorNode, MovementProfile, Tower } from '@/model/types';
import { shellKindAt } from './shell';

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

/** Ground-aura moat hard-denies crawler walk on empty ground macros. */
export function isMoatBlockedGround(tower: Tower, subCol: number, subRow: number): boolean {
  if (subRow !== 0) return false;
  const mc = macroCol(subCol);
  const mr = macroRow(subRow);
  if (hasStructure(tower, mc, mr)) return false;
  return hostsOfKindNearGround(tower, mc, mr, MOAT);
}

/** Soft ground costs from glacis / stakes auras (max wins). */
export function groundAuraStepCost(tower: Tower, subCol: number, subRow: number): number {
  if (subRow !== 0) return 1;
  const mc = macroCol(subCol);
  const mr = macroRow(subRow);
  if (hasStructure(tower, mc, mr)) return 1;
  let cost = 1;
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

/**
 * Parapet: block walk cells whose only/supporting onTop contact is against a parapet cell
 * (empty cell directly above a parapet host).
 */
export function isParapetBlocked(
  tower: Tower,
  subCol: number,
  subRow: number,
  contacts: Set<string>,
): boolean {
  if (!contacts.has('onTop')) return false;
  const mc = macroCol(subCol);
  const mr = macroRow(subRow);
  // onTop means framing at (mc, mr - 1)
  const hostRow = mr - 1;
  if (hostRow < 0) return false;
  return shellKindAt(tower, mc, hostRow) === 'parapet';
}

/** Cornice: deny underCeiling against a cornice host even for under_overhang profiles. */
export function isCorniceBlocked(
  tower: Tower,
  subCol: number,
  subRow: number,
  contacts: Set<string>,
): boolean {
  if (!contacts.has('underCeiling')) return false;
  const mc = macroCol(subCol);
  const mr = macroRow(subRow);
  // underCeiling means framing at (mc, mr + 1)
  return shellKindAt(tower, mc, mr + 1) === 'cornice';
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
 * Hard denies are handled in isWalkable — this only soft-funnels.
 */
export function stepCost(tower: Tower, node: ExteriorNode, profile: MovementProfile): number {
  if (profile.canFly) return 1;
  const ground = groundAuraStepCost(tower, node.col, node.row);
  const barb = barbicanStepCost(tower, node.col, node.row);
  return Math.max(ground, barb);
}

export function stakesSlowMultiplier(tower: Tower, enemyPos: ExteriorNode, canFly: boolean): number {
  if (canFly) return 1;
  return isOnStakesAura(tower, enemyPos.col, enemyPos.row) ? STAKES_SLOW_MULT : 1;
}
