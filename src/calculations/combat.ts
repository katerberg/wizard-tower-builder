import { nextRandom } from './rng';
import { aggregateModifierStats } from '../model/modifications';
import type { Blueprint, Room, RoomStats, Structure, StructureStats } from '../model/types';

export interface Combatant { attack: number; defense: number; dexterity: number }

export interface DamageResult { damage: number; dodged: boolean; rngState: number }

/**
 * Mirrors 7drl's dex-dodge + flat mitigation, decoupled from any renderer.
 * Dodge chance rises with the defender's dexterity advantage, capped at 50%.
 */
export function computeDamage(attacker: Combatant, defender: Combatant, rngState: number): DamageResult {
  const dexAdvantage = defender.dexterity - attacker.dexterity;
  const dodgeChance = Math.max(0, Math.min(0.5, dexAdvantage * 0.05));
  const { value, state } = nextRandom(rngState);
  if (value < dodgeChance) {
    return { damage: 0, dodged: true, rngState: state };
  }
  const damage = Math.max(1, attacker.attack - defender.defense);
  return { damage, dodged: false, rngState: state };
}

// Base stats come from the blueprint; modifications add passive bonuses on top.
export function computeRoomStats(room: Room, blueprint: Blueprint): RoomStats {
  const bonus = aggregateModifierStats(room.modifications);
  return {
    maxHp: blueprint.baseHp + (bonus.maxHp ?? 0),
    attack: bonus.attack ?? 0,
    defense: bonus.defense ?? 0,
  };
}

export function computeStructureStats(_structure: Structure, blueprint: Blueprint): StructureStats {
  return { maxHp: blueprint.baseHp };
}
