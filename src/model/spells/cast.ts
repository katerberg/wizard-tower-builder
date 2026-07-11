import { computeDamage, type Combatant } from '../../calculations/combat';
import { macroCellOfNode, macroGridDistance } from '../../calculations/subGrid';
import { getEnemyTemplate } from '../enemies';
import { addMessage } from '../messages';
import { loseGame } from '../phases';
import { getWizardPosition } from '../tower';
import { getEffectiveWizardPosition } from './air/flight';
import { applyWindDamage } from './air/windDamage';
import { tornadoGridLine } from './air/tornado';
import { applyFireDamage } from './fire/fireDamage';
import { isValidKindlingPlacement } from './fire/kindling';
import { gridLine, sameFaceEndpoints } from './fire/wall';
import { blizzard } from './blizzard';
import { fireball } from './fireball';
import { flight } from './flight';
import { gust } from './gust';
import { immolate } from './immolate';
import { kindling } from './kindling';
import { tornado } from './tornado';
import { wandStrike } from './wandStrike';
import { wallOfFlame } from './wallOfFlame';
import type { CastCheckResult, SpellCastContext, SpellDef, SpellTarget } from './types';
import type { Cell, Enemy, GameState, SpellSchool } from '../types';

export type { CastCheckResult, SpellCastContext, SpellDef, SpellTarget } from './types';
export { fireball, aoeCells, enemiesInFireballBlast } from './fireball';
export { wandStrike } from './wandStrike';
export { immolate } from './immolate';
export { kindling } from './kindling';
export { wallOfFlame, gridLine, sameFaceEndpoints } from './wallOfFlame';
export { gust } from './gust';
export { tornado, tornadoGridLine } from './tornado';
export { flight } from './flight';
export { blizzard } from './blizzard';
export { applyFireDamage } from './fire/fireDamage';
export { isKindled, applyKindled, clearKindled } from './fire/kindled';
export { isValidKindlingPlacement, addKindlingPatch, runKindlingPatchStepEffects } from './fire/kindling';
export { isOnWall, startImmolate, clearImmolate, isImmolating, onEnemyWallStep } from './fire/immolate';
export { resetFireState, tickFireEffects } from './fire/tick';
export { applyDiscombobulated, isDiscombobulated, shouldStubDiscombobulatedStep } from './air/discombobulated';
export { applyWindDamage } from './air/windDamage';
export { resetAirState, tickAirEffects, blizzardSlowMultiplier, isMacroCellBlockedByTornado, addTornadoSegment } from './air/tick';
export { getEffectiveWizardPosition } from './air/flight';
export { blizzardZoneCells, isInBlizzardZone } from './air/blizzard';
export { gustAffectedCells } from './air/push';

export const FIRE_HOTBAR_SPELL_IDS = ['fireball', 'immolate', 'wallOfFlame', 'kindling'] as const;
export const AIR_HOTBAR_SPELL_IDS = ['gust', 'tornado', 'flight', 'blizzard'] as const;
export const HOTBAR_SLOT_COUNT = 6;

const SPELLS: SpellDef[] = [
  fireball,
  immolate,
  wallOfFlame,
  kindling,
  gust,
  tornado,
  flight,
  blizzard,
  wandStrike,
];

export function getSpell(id: string): SpellDef | undefined {
  return SPELLS.find((s) => s.id === id);
}

export function hotbarSpellIdsForSchool(school: SpellSchool): readonly string[] {
  return school === 'air' ? AIR_HOTBAR_SPELL_IDS : FIRE_HOTBAR_SPELL_IDS;
}

export function listHotbarSpells(state: GameState): SpellDef[] {
  return hotbarSpellIdsForSchool(state.activeSpellSchool)
    .map((id) => getSpell(id))
    .filter((s): s is SpellDef => !!s);
}

export function listAutoSpells(): SpellDef[] {
  return SPELLS.filter((s) => s.autoCast);
}

function gridDistance(state: GameState, _from: { col: number; row: number }, cell: Cell): number {
  const wizardPos = getEffectiveWizardPosition(state);
  return macroGridDistance(wizardPos, cell);
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
    applyWindDamage(enemy, damage) {
      applyWindDamage(ctx, enemy, damage);
    },
    log(text, kind) {
      addMessage(state, text, kind);
    },
    damageWizard(damage) {
      const wizard = state.player.wizard;
      wizard.hp = Math.max(0, wizard.hp - damage);
      addMessage(state, `${spellName} batters the wizard for ${damage}!`, 'combat');
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

  if (spell.targeting === 'self') {
    return { ok: true };
  }

  if (spell.targeting === 'gridPoint') {
    if (target?.kind !== 'cell') return { ok: false, reason: 'no_target' };
    if (gridDistance(state, getWizardPosition(state.tower), target.cell) > spell.range) {
      return { ok: false, reason: 'out_of_range' };
    }
  }

  if (spell.targeting === 'trapAdjacent') {
    if (target?.kind !== 'cell') return { ok: false, reason: 'no_target' };
    if (gridDistance(state, getWizardPosition(state.tower), target.cell) > spell.range) {
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
    const wizardPos = getEffectiveWizardPosition(state);
    if (enemyGridDistance(wizardPos, enemy.pos) > spell.range) {
      return { ok: false, reason: 'out_of_range' };
    }
  }

  if (spell.targeting === 'segment') {
    if (target?.kind === 'cell') {
      if (gridDistance(state, getWizardPosition(state.tower), target.cell) > spell.range) {
        return { ok: false, reason: 'out_of_range' };
      }
      return { ok: true };
    }
    if (target?.kind !== 'segment') return { ok: false, reason: 'no_target' };
    if (gridDistance(state, getWizardPosition(state.tower), target.from) > spell.range
      || gridDistance(state, getWizardPosition(state.tower), target.to) > spell.range) {
      return { ok: false, reason: 'out_of_range' };
    }
    if (!sameFaceEndpoints(state.tower, target.from, target.to)) {
      return { ok: false, reason: 'invalid_segment' };
    }
    if (!gridLine(target.from, target.to)) {
      return { ok: false, reason: 'invalid_segment' };
    }
  }

  if (spell.targeting === 'airSegment') {
    if (target?.kind === 'cell') {
      if (gridDistance(state, getEffectiveWizardPosition(state), target.cell) > spell.range) {
        return { ok: false, reason: 'out_of_range' };
      }
      return { ok: true };
    }
    if (target?.kind !== 'segment') return { ok: false, reason: 'no_target' };
    if (gridDistance(state, getEffectiveWizardPosition(state), target.from) > spell.range
      || gridDistance(state, getEffectiveWizardPosition(state), target.to) > spell.range) {
      return { ok: false, reason: 'out_of_range' };
    }
    if (!tornadoGridLine(target.from, target.to)) {
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

export function setActiveSpellSchool(state: GameState, school: SpellSchool): void {
  state.activeSpellSchool = school;
}

export function castSpellUnchecked(state: GameState, spellId: string, target: SpellTarget): void {
  const spell = getSpell(spellId);
  if (!spell) return;
  spell.cast(buildContext(state, spell), target);
}
