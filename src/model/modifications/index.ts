import {
  addResources,
  emptyResources,
  scaleResources,
} from '../../calculations/resources';
import type { Room, RoomStats, Tower } from '../types';
import type { ModificationDef } from './types';
import { boilerExpansion } from './boilerExpansion';
import { chamberExpansion } from './chamberExpansion';
import { guardroomExpansion } from './guardroomExpansion';
import { quartersExpansion } from './quartersExpansion';
import { slotExpansion } from './slotExpansion';
import { spikes } from './spikes';

export type { ModificationDef, ModEffectContext } from './types';

const DEFAULT_REFUND_RATE = 0.5;

/** Every modification the game knows about. Add new types here. */
export const MODIFICATIONS: ModificationDef[] = [
  spikes,
  guardroomExpansion,
  chamberExpansion,
  quartersExpansion,
  slotExpansion,
  boilerExpansion,
];

export function getModification(id: string): ModificationDef | undefined {
  return MODIFICATIONS.find((m) => m.id === id);
}

export function listModifications(): ModificationDef[] {
  return MODIFICATIONS;
}

/** Resource cost to bring a modification to `level` (level 1 = adding it). */
export function modificationCost(def: ModificationDef, level: number) {
  return def.cost(level);
}

/** Mechanical detail line(s) for the room inspector and tooltips. */
export function formatModificationMechanics(
  def: ModificationDef,
  level: number,
  action: 'none' | 'add' | 'upgrade' | 'max',
): string {
  if (action === 'add') {
    return `Lv1: ${def.mechanicsAtLevel(1)}`;
  }
  if (action === 'upgrade') {
    return `Lv${level}: ${def.mechanicsAtLevel(level)} → Lv${level + 1}: ${def.mechanicsAtLevel(level + 1)}`;
  }
  if (level > 0) {
    return `Lv${level}: ${def.mechanicsAtLevel(level)}`;
  }
  return '';
}

function modificationLevelOn(room: Room, id: string): number {
  return room.modifications.find((m) => m.id === id)?.level ?? 0;
}

/** True when the modification can be freshly added to the room. */
export function canApplyModification(room: Room, tower: Tower, id: string): boolean {
  const def = getModification(id);
  if (!def) return false;
  if (modificationLevelOn(room, id) > 0) return false; // one instance per type
  if (def.canApply && !def.canApply(room, tower)) return false;
  return true;
}

/** Research-aware apply check (pass unlocked mod ids from the player). */
export function canApplyUnlockedModification(
  room: Room,
  tower: Tower,
  id: string,
  unlockedModifications: readonly string[],
): boolean {
  if (!unlockedModifications.includes(id)) return false;
  return canApplyModification(room, tower, id);
}

/** True when an existing modification can be upgraded another level. */
export function canUpgradeModification(room: Room, id: string): boolean {
  const def = getModification(id);
  if (!def) return false;
  const level = modificationLevelOn(room, id);
  return level > 0 && level < def.maxLevel;
}

/** Total resources refunded for all of a room's modifications when it is sold. */
export function modificationRefund(room: Room) {
  let refund = emptyResources();
  for (const mod of room.modifications) {
    const def = getModification(mod.id);
    if (!def) continue;
    const rate = def.sellRefundRate ?? DEFAULT_REFUND_RATE;
    let spent = emptyResources();
    for (let level = 1; level <= mod.level; level++) {
      spent = addResources(spent, def.cost(level));
    }
    const partial = scaleResources(spent, rate);
    refund = addResources(refund, {
      gold: Math.floor(partial.gold),
      metal: Math.floor(partial.metal),
      stone: Math.floor(partial.stone),
      souls: Math.floor(partial.souls),
    });
  }
  return refund;
}

/** Sum the passive stat contributions of a room's modifications. */
export function aggregateModifierStats(modifications: Room['modifications']): Partial<RoomStats> {
  const total: Partial<RoomStats> = {};
  for (const mod of modifications) {
    const def = getModification(mod.id);
    if (!def?.passiveStats) continue;
    const stats = def.passiveStats(mod.level);
    if (stats.maxHp) total.maxHp = (total.maxHp ?? 0) + stats.maxHp;
    if (stats.attack) total.attack = (total.attack ?? 0) + stats.attack;
    if (stats.defense) total.defense = (total.defense ?? 0) + stats.defense;
  }
  return total;
}
