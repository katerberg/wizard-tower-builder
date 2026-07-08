import { computeDamage, type Combatant } from '../../calculations/combat';
import { macroCellOfNode, macroGridDistance } from '../../calculations/subGrid';
import { getEnemyTemplate } from '../enemies';
import { addMessage } from '../messages';
import { loseGame } from '../phases';
import { getWizardPosition } from '../tower';
import { applyFireDamage } from './fire/fireDamage';
import { isValidKindlingPlacement } from './fire/kindling';
import { gridLine, sameFaceEndpoints } from './fire/wall';
import { fireball } from './fireball';
import { immolate } from './immolate';
import { kindling } from './kindling';
import { wandStrike } from './wandStrike';
import { wallOfFlame } from './wallOfFlame';
import type { CastCheckResult, SpellCastContext, SpellDef, SpellTarget } from './types';
import type { Cell, Enemy, GameState } from '../types';

export type { CastCheckResult, SpellCastContext, SpellDef, SpellTarget } from './types';
export { fireball, aoeCells, enemiesInFireballBlast } from './fireball';
export { wandStrike } from './wandStrike';
export { immolate } from './immolate';
export { kindling } from './kindling';
export { wallOfFlame, gridLine, sameFaceEndpoints } from './wallOfFlame';
export { applyFireDamage } from './fire/fireDamage';
export { isKindled, applyKindled, clearKindled } from './fire/kindled';
export { isValidKindlingPlacement, addKindlingPatch, runKindlingPatchStepEffects } from './fire/kindling';
export { isOnWall, startImmolate, clearImmolate, isImmolating, onEnemyWallStep } from './fire/immolate';
export { resetFireState, tickFireEffects } from './fire/tick';

/** Spells shown on the attack-phase hotbar (manual cast only). */
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
  return macroGridDistance(from, cell);
}

function enemyGridDistance(a: { col: number; row: number }, b: { col: number; row: number }): number {
  const am = macroCellOfNode(a);
  const bm = macroCellOfNode(b);
  return Math.abs(am.col - bm.col) + Math.abs(am.row - bm.row);
}

export function enemyAtCell(state: GameState, cell: Cell): Enemy | undefined {
  return state.enemies.find((e) => {
    if (e.currentHp <= 0) return false;
    const macro = macroCellOfNode(e.pos);
    return macro.col === cell.col && macro.row === cell.row;
  });
}

export function buildSpellContext(state: GameState, spellName: string): SpellCastContext {
  const ctx: SpellCastContext = {
    state,
    spellName,
    damageEnemy(enemy, damage, dexterity = 0) {
      const template = getEnemyTemplate(enemy.templateId);
      if (!template) return;
      const attacker: Combatant = { attack: damage, defense: 0, dexterity };
      const defender: Combatant = { attack: 0, defense: 0, dexterity: template.stats.dexterity };
      const result = computeDamage(attacker, defender, state.rngState);
      state.rngState = result.rngState;
      if (result.dodged) {
        addMessage(state, `${enemy.name} the ${template.type} dodges the ${spellName}.`, 'combat');
      } else {
        enemy.currentHp -= result.damage;
        addMessage(state, `${spellName} hits ${enemy.name} the ${template.type} for ${result.damage}.`, 'combat');
      }
    },
    applyFireDamage(enemy, damage, dexterity = 0) {
      applyFireDamage(ctx, enemy, damage, dexterity);
    },
    log(text, kind) {
      addMessage(state, text, kind);
    },
    damageWizard(damage) {
      const wizard = state.player.wizard;
      wizard.hp = Math.max(0, wizard.hp - damage);
      addMessage(state, `${spellName} scorches the wizard for ${damage}!`, 'combat');
      if (wizard.hp <= 0) {
        loseGame(state);
      }
    },
  };
  return ctx;
}

function buildContext(state: GameState, spell: SpellDef): SpellCastContext {
  return buildSpellContext(state, spell.name);
}

export function spellCooldownRemaining(state: GameState, spellId: string): number {
  return Math.max(0, state.spellCooldowns[spellId] ?? 0);
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

  if (spell.targeting === 'trapAdjacent') {
    if (target?.kind !== 'cell') return { ok: false, reason: 'no_target' };
    if (gridDistance(wizardPos, target.cell) > spell.range) {
      return { ok: false, reason: 'out_of_range' };
    }
    if (!isValidKindlingPlacement(state.tower, target.cell)) {
      return { ok: false, reason: 'invalid_placement' };
    }
  }

  if (spell.targeting === 'enemy') {
    if (target?.kind !== 'enemy') return { ok: false, reason: 'no_target' };
    const enemy = state.enemies.find((e) => e.id === target.enemyId);
    if (!enemy || enemy.currentHp <= 0) return { ok: false, reason: 'no_target' };
    if (enemyGridDistance(wizardPos, enemy.pos) > spell.range) {
      return { ok: false, reason: 'out_of_range' };
    }
  }

  if (spell.targeting === 'segment') {
    if (target?.kind === 'cell') {
      if (gridDistance(wizardPos, target.cell) > spell.range) {
        return { ok: false, reason: 'out_of_range' };
      }
      return { ok: true };
    }
    if (target?.kind !== 'segment') return { ok: false, reason: 'no_target' };
    if (gridDistance(wizardPos, target.from) > spell.range || gridDistance(wizardPos, target.to) > spell.range) {
      return { ok: false, reason: 'out_of_range' };
    }
    if (!sameFaceEndpoints(state.tower, target.from, target.to)) {
      return { ok: false, reason: 'invalid_segment' };
    }
    if (!gridLine(target.from, target.to)) {
      return { ok: false, reason: 'invalid_segment' };
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
