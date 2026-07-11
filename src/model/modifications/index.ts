import type { Room, RoomStats, Tower } from '../types';
import type { ModificationDef } from './types';
import { barracksExpansion } from './barracksExpansion';
import { slotExpansion } from './slotExpansion';
import { spikes } from './spikes';

export type { ModificationDef, ModEffectContext } from './types';

const DEFAULT_REFUND_RATE = 0.5;

/** Every modification the game knows about. Add new types here. */
export const MODIFICATIONS: ModificationDef[] = [spikes, barracksExpansion, slotExpansion];

export function getModification(id: string): ModificationDef | undefined {
  return MODIFICATIONS.find((m) => m.id === id);
}

export function listModifications(): ModificationDef[] {
  return MODIFICATIONS;
}

/** Gold cost to bring a modification to `level` (level 1 = adding it). */
export function modificationCost(def: ModificationDef, level: number): number {
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

/** True when an existing modification can be upgraded another level. */
export function canUpgradeModification(room: Room, id: string): boolean {
  const def = getModification(id);
  if (!def) return false;
  const level = modificationLevelOn(room, id);
  return level > 0 && level < def.maxLevel;
}

/** Total gold refunded for all of a room's modifications when it is sold. */
export function modificationRefund(room: Room): number {
  let refund = 0;
  for (const mod of room.modifications) {
    const def = getModification(mod.id);
    if (!def) continue;
    const rate = def.sellRefundRate ?? DEFAULT_REFUND_RATE;
    let spent = 0;
    for (let level = 1; level <= mod.level; level++) {
      spent += def.cost(level);
    }
    refund += Math.floor(spent * rate);
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
