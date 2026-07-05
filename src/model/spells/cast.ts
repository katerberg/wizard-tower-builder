import { computeDamage, type Combatant } from '../../calculations/combat';
import { getEnemyTemplate } from '../enemies';
import { addMessage } from '../messages';
import { loseGame } from '../phases';
import { getWizardPosition } from '../tower';
import { fireball } from './fireball';
import { immolate } from './fire/immolateSpell';
import { kindling } from './fire/kindlingSpell';
import { wallOfFlame } from './fire/wallOfFlameSpell';
import { isKindlingTrapCell } from './fire/kindling';
import { validateWallSegment } from './fire/wallOfFlame';
import { wandStrike } from './wandStrike';
import type { CastCheckResult, SpellCastContext, SpellDef, SpellTarget } from './types';
import type { Cell, GameState } from '../types';

export type { CastCheckResult, SpellCastContext, SpellDef, SpellTarget } from './types';
export { fireball, aoeCells, enemiesInFireballBlast } from './fireball';
export { wandStrike } from './wandStrike';
export { resetFireWaveState, tickFireEffects } from './fire';

/** Manual spells on the attack-phase hotbar (fire school playtest kit). */
export const HOTBAR_SPELL_IDS = ['fireball', 'immolate', 'wallOfFlame', 'kindling'] as const;
export const HOTBAR_SLOT_COUNT = 6;

const SPELLS: SpellDef[] = [fireball, immolate, wallOfFlame, kindling, wandStrike];

export function getSpell(id: string): SpellDef | undefined {
  return SPELLS.find((s) => s.id === id);
}

export function listHotbarSpells(): SpellDef[] {
  return HOTBAR_SPELL_IDS.map((id) => getSpell(id)).filter((s): s is SpellDef => !!s);
}

export function listAutoSpells(): SpellDef[] {
  return SPELLS.filter((s) => s.autoCast);
}

function gridDistance(from: { col: number; row: number }, cell: Cell): number {
  return Math.abs(from.col - cell.col) + Math.abs(from.row - cell.row);
}

function buildContext(state: GameState, spell: SpellDef): SpellCastContext {
  return {
    state,
    spellName: spell.name,
    damageEnemy(enemy, damage, dexterity = 0) {
      const template = getEnemyTemplate(enemy.templateId);
      if (!template) return;
      const attacker: Combatant = { attack: damage, defense: 0, dexterity };
      const defender: Combatant = { attack: 0, defense: 0, dexterity: template.stats.dexterity };
      const result = computeDamage(attacker, defender, state.rngState);
      state.rngState = result.rngState;
      if (result.dodged) {
        addMessage(state, `${enemy.name} the ${template.type} dodges the ${spell.name}.`, 'combat');
      } else {
        enemy.currentHp -= result.damage;
        addMessage(state, `${spell.name} hits ${enemy.name} the ${template.type} for ${result.damage}.`, 'combat');
      }
    },
    log(text, kind) {
      addMessage(state, text, kind);
    },
    damageWizard(damage) {
      const wizard = state.player.wizard;
      wizard.hp = Math.max(0, wizard.hp - damage);
      addMessage(state, `${spell.name} scorches the wizard for ${damage}!`, 'combat');
      if (wizard.hp <= 0) {
        loseGame(state);
      }
    },
  };
}

export function spellCooldownRemaining(state: GameState, spellId: string): number {
  return Math.max(0, state.spellCooldowns[spellId] ?? 0);
}

function enemyInRange(state: GameState, enemyId: string, range: number): boolean {
  const enemy = state.enemies.find((e) => e.id === enemyId);
  if (!enemy) return false;
  const wizardPos = getWizardPosition(state.tower);
  return gridDistance(wizardPos, enemy.pos) <= range;
}

export function canCastSpell(state: GameState, spellId: string, target?: SpellTarget): CastCheckResult {
  if (state.scene !== 'run' || state.phase !== 'attack') {
    return { ok: false, reason: 'wrong_phase' };
  }
  const spell = getSpell(spellId);
  if (!spell) return { ok: false, reason: 'unknown_spell' };
  if (spell.autoCast) return { ok: false, reason: 'manual_only' };
  if (state.player.mana < spell.manaCost) return { ok: false, reason: 'no_mana' };
  if (spellCooldownRemaining(state, spellId) > 0) return { ok: false, reason: 'on_cooldown' };

  const wizardPos = getWizardPosition(state.tower);

  if (spell.targeting === 'gridPoint') {
    if (target?.kind !== 'cell') return { ok: false, reason: 'no_target' };
    if (gridDistance(wizardPos, target.cell) > spell.range) {
      return { ok: false, reason: 'out_of_range' };
    }
  }

  if (spell.targeting === 'enemy') {
    if (target?.kind !== 'enemy') return { ok: false, reason: 'no_target' };
    if (!enemyInRange(state, target.enemyId, spell.range)) {
      return { ok: false, reason: 'out_of_range' };
    }
    const enemy = state.enemies.find((e) => e.id === target.enemyId);
    if (!enemy || enemy.currentHp <= 0) return { ok: false, reason: 'invalid_target' };
  }

  if (spell.targeting === 'kindlingTrap') {
    if (target?.kind !== 'cell') return { ok: false, reason: 'no_target' };
    if (gridDistance(wizardPos, target.cell) > spell.range) {
      return { ok: false, reason: 'out_of_range' };
    }
    if (!isKindlingTrapCell(state.tower, target.cell)) {
      return { ok: false, reason: 'invalid_target' };
    }
  }

  if (spell.targeting === 'wallSegment') {
    if (target?.kind !== 'segment') return { ok: false, reason: 'no_target' };
    if (
      gridDistance(wizardPos, target.a) > spell.range ||
      gridDistance(wizardPos, target.b) > spell.range
    ) {
      return { ok: false, reason: 'out_of_range' };
    }
    if (!validateWallSegment(state.tower, target.a, target.b).ok) {
      return { ok: false, reason: 'invalid_target' };
    }
  }

  return { ok: true };
}

export function castSpell(state: GameState, spellId: string, target: SpellTarget): CastCheckResult {
  const check = canCastSpell(state, spellId, target);
  if (!check.ok) return check;

  const spell = getSpell(spellId)!;
  state.player.mana -= spell.manaCost;
  state.spellCooldowns[spellId] = spell.cooldown;
  spell.cast(buildContext(state, spell), target);
  return { ok: true };
}

export function tickSpellCooldowns(state: GameState, dt: number): void {
  for (const id of Object.keys(state.spellCooldowns)) {
    const remaining = state.spellCooldowns[id] - dt;
    if (remaining <= 0) {
      delete state.spellCooldowns[id];
    } else {
      state.spellCooldowns[id] = remaining;
    }
  }
}

function tryAutoCast(state: GameState, spell: SpellDef): void {
  if (spellCooldownRemaining(state, spell.id) > 0) return;
  if (spell.targeting === 'autoNearest') {
    state.spellCooldowns[spell.id] = spell.cooldown;
    spell.cast(buildContext(state, spell), { kind: 'cell', cell: { col: 0, row: 0 } });
  }
}

export function runAutoSpells(state: GameState): void {
  for (const spell of listAutoSpells()) {
    tryAutoCast(state, spell);
  }
}

export function refillMana(state: GameState): void {
  state.player.mana = state.player.maxMana;
}

export function resetSpellCooldowns(state: GameState): void {
  state.spellCooldowns = {};
}

/** Test helper: direct damage without cooldown/mana checks. */
export function castSpellUnchecked(state: GameState, spellId: string, target: SpellTarget): void {
  const spell = getSpell(spellId);
  if (!spell) return;
  spell.cast(buildContext(state, spell), target);
}

export function findEnemyAtCell(state: GameState, cell: Cell): string | null {
  for (const enemy of state.enemies) {
    if (enemy.currentHp <= 0) continue;
    if (enemy.pos.col === cell.col && enemy.pos.row === cell.row) {
      return enemy.id;
    }
  }
  return null;
}
