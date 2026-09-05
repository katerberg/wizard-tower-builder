import { roomCells } from '@/calculations/grid';
import { seedFrom } from '@/calculations/rng';
import {
  LEYLINE_BAND_ROWS,
  bandRowForTier,
  tierForBandRow,
  type LeylineBandRow,
  type LeylineTier,
} from '@/config/spellProgression';
import { getBlueprint } from '@/model/blueprints';
import { addMessage } from '@/model/messages';
import type { Cell, GameState, PlacementResult, Room, SpellSchool } from '@/model/types';
import { getSpell, hotbarSpellIdsForSchool } from './registry';
import type { SpellDef } from './types';

export const LEYLINE_RESEARCH_BLUEPRINT_ID = 'leylineResearchRoom';

export const SPELL_SCHOOLS: readonly SpellSchool[] = ['fire', 'air', 'earth', 'water'];

const SCHOOL_LABEL: Record<SpellSchool, string> = {
  fire: 'Fire',
  air: 'Air',
  earth: 'Earth',
  water: 'Water',
};

/** Deterministic school pick from the run seed (uniform across four schools). */
export function pickSpellSchoolForRun(seed: string | number): SpellSchool {
  const h = seedFrom(seed);
  return SPELL_SCHOOLS[h % SPELL_SCHOOLS.length];
}

export function schoolLabel(school: SpellSchool): string {
  return SCHOOL_LABEL[school];
}

export function isLeylineResearchRoom(room: { blueprintId: string }): boolean {
  return room.blueprintId === LEYLINE_RESEARCH_BLUEPRINT_ID;
}

export function listLeylineResearchRooms(state: GameState): Room[] {
  return state.tower.rooms.filter(isLeylineResearchRoom);
}

/** Band row touched by a room footprint, if any. */
export function bandRowForRoom(room: Room): LeylineBandRow | null {
  for (const cell of roomCells(room.origin, room.size)) {
    const tier = tierForBandRow(cell.row);
    if (tier !== null) return bandRowForTier(tier);
  }
  return null;
}

/** Live leyline room holding a band (spell tiers only count finished rooms). */
export function leylineRoomInBand(state: GameState, bandRow: LeylineBandRow): Room | undefined {
  return listLeylineResearchRooms(state).find((room) => bandRowForRoom(room) === bandRow);
}

interface LeylineFootprint {
  origin: Cell;
  size: { w: number; h: number };
}

function bandRowForFootprint(footprint: LeylineFootprint): LeylineBandRow | null {
  for (const cell of roomCells(footprint.origin, footprint.size)) {
    const tier = tierForBandRow(cell.row);
    if (tier !== null) return bandRowForTier(tier);
  }
  return null;
}

/** Finished rooms and pending leyline plans both hold a band against new paints. */
function leylineFootprintsInBand(
  state: GameState,
  bandRow: LeylineBandRow,
  ignoreOrderIds: readonly string[],
): LeylineFootprint[] {
  const live: LeylineFootprint[] = listLeylineResearchRooms(state)
    .filter((room) => bandRowForRoom(room) === bandRow)
    .map((room) => ({ origin: room.origin, size: room.size }));

  const blueprint = getBlueprint(LEYLINE_RESEARCH_BLUEPRINT_ID);
  if (!blueprint) return live;

  const planned: LeylineFootprint[] = state.constructionOrders
    .filter(
      (order) =>
        order.kind === 'build' &&
        order.blueprintId === LEYLINE_RESEARCH_BLUEPRINT_ID &&
        !order.invalid &&
        !ignoreOrderIds.includes(order.id),
    )
    .map((order) => ({ origin: order.origin, size: blueprint.size }))
    .filter((footprint) => bandRowForFootprint(footprint) === bandRow);

  return [...live, ...planned];
}

export function isLeylineTierCompleted(state: GameState, tier: LeylineTier): boolean {
  return state.leylineCompletedTiers[tier] === true;
}

export function priorTierComplete(state: GameState, tier: LeylineTier): boolean {
  if (tier === 2) return true;
  if (tier === 3) return isLeylineTierCompleted(state, 2);
  return isLeylineTierCompleted(state, 2) && isLeylineTierCompleted(state, 3);
}

export function starterSpellId(state: GameState): string {
  return hotbarSpellIdsForSchool(state.activeSpellSchool)[0];
}

export function spellIdForTier(state: GameState, tier: 1 | 2 | 3 | 4): string {
  return hotbarSpellIdsForSchool(state.activeSpellSchool)[tier - 1];
}

/**
 * Tier N spell is active when:
 * - tier 1 (always), or
 * - tier completed via ritual AND a leyline room still sits on that band.
 * Dev mode unlocks all tiers without rooms.
 */
export function isSpellTierActive(state: GameState, tier: 1 | 2 | 3 | 4): boolean {
  if (state.devMode) return true;
  if (tier === 1) return true;
  if (tier === 2 || tier === 3 || tier === 4) {
    if (!isLeylineTierCompleted(state, tier)) return false;
    return leylineRoomInBand(state, bandRowForTier(tier)) !== undefined;
  }
  return false;
}

/** Four school hotbar entries; `null` = empty/locked slot. */
export function activeHotbarSpellIds(state: GameState): readonly (string | null)[] {
  const schoolIds = hotbarSpellIdsForSchool(state.activeSpellSchool);
  const tiers: (1 | 2 | 3 | 4)[] = [1, 2, 3, 4];
  return tiers.map((tier) => {
    if (!isSpellTierActive(state, tier)) return null;
    return schoolIds[tier - 1] ?? null;
  });
}

/** Active hotbar SpellDefs (dense). Slot layout with empty holes uses activeHotbarSpellIds. */
export function listHotbarSpells(state: GameState): SpellDef[] {
  return activeHotbarSpellIds(state)
    .filter((id): id is string => id != null)
    .map((id) => getSpell(id))
    .filter((s): s is SpellDef => !!s);
}

export function isSpellUnlocked(state: GameState, spellId: string): boolean {
  if (state.devMode) {
    return hotbarSpellIdsForSchool(state.activeSpellSchool).includes(spellId);
  }
  return activeHotbarSpellIds(state).includes(spellId);
}

export interface LeylinePlacementOptions {
  /** Pending orders this paint replaces, so they stop holding their band. */
  ignoreOrderIds?: readonly string[];
}

/**
 * Placement rules for Leyline Research rooms.
 * Returns null when the blueprint is not a leyline room (caller uses normal canPlace).
 */
export function validateLeylineRoomPlacement(
  state: GameState,
  blueprintId: string,
  origin: Cell,
  size: { w: number; h: number },
  options: LeylinePlacementOptions = {},
): PlacementResult | null {
  if (blueprintId !== LEYLINE_RESEARCH_BLUEPRINT_ID) return null;

  const cells = roomCells(origin, size);
  let band: LeylineBandRow | null = null;
  for (const cell of cells) {
    const tier = tierForBandRow(cell.row);
    if (tier !== null) {
      band = bandRowForTier(tier);
      break;
    }
  }
  if (band === null) {
    return { ok: false, reason: 'leyline_band_required' };
  }

  const tier = tierForBandRow(band);
  if (tier === null) {
    return { ok: false, reason: 'leyline_band_required' };
  }
  if (!priorTierComplete(state, tier)) {
    return { ok: false, reason: 'leyline_tier_locked' };
  }

  const footKeys = new Set(cells.map((c) => `${c.col},${c.row}`));
  for (const existing of leylineFootprintsInBand(state, band, options.ignoreOrderIds ?? [])) {
    // Allow rebuild when the new footprint fully covers the existing room or plan.
    const fullyCovered = roomCells(existing.origin, existing.size).every((c) =>
      footKeys.has(`${c.col},${c.row}`),
    );
    if (!fullyCovered) {
      return { ok: false, reason: 'leyline_band_taken' };
    }
  }

  return { ok: true, reason: 'ok' };
}

/** Complete a leyline ritual tier when the wave-clear hook succeeds. */
export function completeLeylineTier(state: GameState, tier: LeylineTier): void {
  if (isLeylineTierCompleted(state, tier)) return;
  if (!priorTierComplete(state, tier)) return;
  state.leylineCompletedTiers[tier] = true;
  const spell = getSpell(spellIdForTier(state, tier));
  addMessage(
    state,
    spell
      ? `Leyline research complete — ${spell.name} awakened.`
      : `Leyline research complete — tier ${tier} spell awakened.`,
    'info',
  );
}

/**
 * After tower mutations: warn when a completed tier loses its band room,
 * and return spell ids that are no longer active (for deselect).
 */
export function refreshLeylineSpellState(
  state: GameState,
  previousActiveIds: readonly (string | null)[],
): string[] {
  const next = activeHotbarSpellIds(state);
  const lost: string[] = [];
  for (let i = 0; i < previousActiveIds.length; i++) {
    const prev = previousActiveIds[i];
    if (prev && next[i] !== prev) {
      lost.push(prev);
      const spell = getSpell(prev);
      addMessage(
        state,
        spell
          ? `${spell.name} faded — leyline anchor lost.`
          : 'A spell faded — leyline anchor lost.',
        'info',
      );
    }
  }
  return lost;
}

export function announceSpellSchool(state: GameState): void {
  const spell = getSpell(starterSpellId(state));
  addMessage(
    state,
    `Your tower resonates with ${schoolLabel(state.activeSpellSchool)} — ${spell?.name ?? 'a spell'} awakened.`,
    'info',
  );
}

/** Expose band constant for overlays / docs consumers. */
export { LEYLINE_BAND_ROWS };
