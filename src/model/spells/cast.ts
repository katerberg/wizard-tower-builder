import { computeDamage, type Combatant } from '../../calculations/combat';
import { macroCellOfNode, macroGridDistance } from '../../calculations/subGrid';
import { getEnemyTemplate } from '../enemies';
import { addMessage } from '../messages';
import { applyCollectorDamage, collectorIsBroken } from '../enemies/raid';
import { structureAt } from '../tower/query';
import { getSolarCollectorPosition } from '../wizard';
import { getWizardPosition } from '../tower';
import { getEffectiveWizardPosition } from './air/flight';
import { applyWindDamage } from './air/windDamage';
import { tornadoGridLine } from './air/tornado';
import { applyFireDamage } from './fire/fireDamage';
import { gridLine, validWallOfFlameSegment } from './fire/wall';
import { getCharge } from './earth/charge';
import { clearFortify, isFortified, mitigateWizardDamage } from './earth/fortify';
import { roomIdAtCell } from './earth/earthquake';
import { getSpell, listAutoSpells } from './registry';
import { isSpellUnlocked } from './progression';
import type { CastCheckResult, SpellCastContext, SpellDef, SpellTarget } from './types';
import type { Cell, Enemy, GameState, SpellSchool } from '../types';

export type { CastCheckResult, SpellCastContext, SpellDef, SpellTarget } from './types';
export {
  getSpell,
  listAutoSpells,
  hotbarSpellIdsForSchool,
  listSchoolHotbarSpells,
  FIRE_HOTBAR_SPELL_IDS,
  AIR_HOTBAR_SPELL_IDS,
  EARTH_HOTBAR_SPELL_IDS,
  WATER_HOTBAR_SPELL_IDS,
  HOTBAR_SLOT_COUNT,
} from './registry';
export { listHotbarSpells } from './progression';

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
  const damageCollector = (damage: number) => {
    if (collectorIsBroken(state)) {
      const perch = macroCellOfNode(getSolarCollectorPosition(state));
      const structure = structureAt(state.tower, perch.col, perch.row);
      if (!structure) return;
      const live = state.tower.structures.find((s) => s.id === structure.id);
      if (!live) return;
      live.hp = Math.max(0, live.hp - damage);
      addMessage(state, `${spellName} batters framing at the perch for ${damage}!`, 'combat');
      return;
    }
    const dealt = mitigateWizardDamage(state, damage);
    applyCollectorDamage(state, dealt);
    addMessage(state, `${spellName} batters the solar collector for ${dealt}!`, 'combat');
  };
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
    damageWizard: damageCollector,
    damageCollector,
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
  if (state.scene !== 'run' || state.phase !== 'night') {
    return { ok: false, reason: 'wrong_phase' };
  }
  const spell = getSpell(spellId);
  if (!spell) return { ok: false, reason: 'unknown_spell' };
  if (spell.autoCast) return { ok: false, reason: 'manual_only' };

  if (!state.devMode && !isSpellUnlocked(state, spellId) && spellId !== 'wandStrike') {
    return { ok: false, reason: 'locked' };
  }

  if (spellId === 'fortify' && collectorIsBroken(state)) {
    return { ok: false, reason: 'collector_broken' };
  }

  if (isFortified(state) && !spell.allowedWhileConcentrating) {
    return { ok: false, reason: 'concentrating' };
  }

  if (state.player.mana < spell.manaCost) return { ok: false, reason: 'no_mana' };
  if (spellCooldownRemaining(state, spellId) > 0) return { ok: false, reason: 'on_cooldown' };

  if (spell.requiresCharge && getCharge(state) <= 0) {
    return { ok: false, reason: 'no_charge' };
  }

  if (spell.targeting === 'self') {
    return { ok: true };
  }

  if (spell.targeting === 'gridPoint') {
    if (target?.kind !== 'cell') return { ok: false, reason: 'no_target' };
    if (gridDistance(state, getWizardPosition(state.tower), target.cell) > spell.range) {
      return { ok: false, reason: 'out_of_range' };
    }
  }

  if (spell.targeting === 'puddle') {
    if (target?.kind !== 'cell') return { ok: false, reason: 'no_target' };
    if (gridDistance(state, getWizardPosition(state.tower), target.cell) > spell.range) {
      return { ok: false, reason: 'out_of_range' };
    }
    if (spell.validatePlacement && !spell.validatePlacement(state, target.cell)) {
      return { ok: false, reason: 'invalid_placement' };
    }
  }

  if (spell.targeting === 'trapAdjacent') {
    if (target?.kind !== 'cell') return { ok: false, reason: 'no_target' };
    if (gridDistance(state, getWizardPosition(state.tower), target.cell) > spell.range) {
      return { ok: false, reason: 'out_of_range' };
    }
    if (!spell.validatePlacement?.(state, target.cell)) {
      return { ok: false, reason: 'invalid_placement' };
    }
  }

  if (spell.targeting === 'room') {
    if (target?.kind !== 'cell') return { ok: false, reason: 'no_target' };
    if (gridDistance(state, getWizardPosition(state.tower), target.cell) > spell.range) {
      return { ok: false, reason: 'out_of_range' };
    }
    if (!roomIdAtCell(state.tower, target.cell)) {
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
    if (!validWallOfFlameSegment(state.tower, target.from, target.to)) {
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
  if (isFortified(state) && spell.breaksConcentration) {
    clearFortify(state, 'Fortify breaks — the mountain moves!');
  }

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
  if (isFortified(state)) return;
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
