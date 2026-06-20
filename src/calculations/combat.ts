import { nextRandom } from './rng';
import type { Blueprint, Room, RoomStats } from '../model/types';

export type Combatant = { attack: number; defense: number; dexterity: number };

export type DamageResult = { damage: number; dodged: boolean; rngState: number };

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

// v1: stats come from the blueprint only (room contents deferred to v2+).
export function computeRoomStats(_room: Room, blueprint: Blueprint): RoomStats {
  return { maxHp: blueprint.baseHp, attack: 0, defense: 0 };
}
