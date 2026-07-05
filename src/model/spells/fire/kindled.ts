import { computeDamage, type Combatant } from '@/calculations/combat';
import { getEnemyTemplate } from '@/model/enemies';
import { addMessage } from '@/model/messages';
import { KINDLED_BURST_DAMAGE, KINDLED_DURATION } from './constants';
import type { Enemy, GameState } from '@/model/types';

export function isKindled(state: GameState, enemyId: string): boolean {
  const until = state.kindledUntil[enemyId];
  return until != null && state.waveTimer < until;
}

export function applyKindled(state: GameState, enemy: Enemy): void {
  state.kindledUntil[enemy.id] = state.waveTimer + KINDLED_DURATION;
}

/** Refresh or apply Kindled (15s from now). */
export function refreshKindled(state: GameState, enemy: Enemy): void {
  applyKindled(state, enemy);
}

function rollDamage(
  state: GameState,
  attacker: Combatant,
  enemy: Enemy,
  spellName: string,
): { damage: number; dodged: boolean } {
  const template = getEnemyTemplate(enemy.templateId);
  if (!template) return { damage: 0, dodged: true };
  const defender: Combatant = { attack: 0, defense: 0, dexterity: template.stats.dexterity };
  const result = computeDamage(attacker, defender, state.rngState);
  state.rngState = result.rngState;
  if (result.dodged) {
    addMessage(state, `${enemy.name} the ${template.type} dodges the ${spellName}.`, 'combat');
    return { damage: 0, dodged: true };
  }
  return { damage: result.damage, dodged: false };
}

/**
 * Apply fire damage to an enemy: normal hit first, then Kindled flat burst if marked.
 */
export function applyFireDamage(
  state: GameState,
  enemy: Enemy,
  damage: number,
  spellName: string,
  dexterity = 0,
): void {
  if (enemy.currentHp <= 0) return;
  const template = getEnemyTemplate(enemy.templateId);
  if (!template) return;

  const attacker: Combatant = { attack: damage, defense: 0, dexterity };
  const hit = rollDamage(state, attacker, enemy, spellName);
  if (!hit.dodged) {
    enemy.currentHp -= hit.damage;
    addMessage(
      state,
      `${spellName} hits ${enemy.name} the ${template.type} for ${hit.damage}.`,
      'combat',
    );
  }

  if (!isKindled(state, enemy.id) || hit.dodged) return;

  const burstAttacker: Combatant = { attack: KINDLED_BURST_DAMAGE, defense: 0, dexterity: 0 };
  const burst = rollDamage(state, burstAttacker, enemy, `${spellName} (Kindled burst)`);
  if (!burst.dodged) {
    enemy.currentHp -= burst.damage;
    addMessage(
      state,
      `Kindled burst hits ${enemy.name} the ${template.type} for ${burst.damage}!`,
      'combat',
    );
  }
  delete state.kindledUntil[enemy.id];
}

export function expireKindled(state: GameState): void {
  for (const [id, until] of Object.entries(state.kindledUntil)) {
    if (state.waveTimer >= until) {
      delete state.kindledUntil[id];
    }
  }
}
