import {
  canAffordResources,
  formatResourceCost,
} from '@/calculations/resources';
import { getBlueprint } from '@/model/blueprints';
import {
  getFortificationBlueprint,
  getFortificationMechanics,
  getFortificationPlacementHint,
} from '@/model/fortificationBlueprints';
import { getInfraBlueprint } from '@/model/infraBlueprints';
import { getRoomBehavior } from '@/model/rooms';
import { getSpell, listHotbarSpells, spellCooldownRemaining } from '@/model/spells';
import { getBuildTool } from '@/store/buildTools';
import type { Snapshot } from '../store';
import { selectBuildEconomy } from './build';

export interface UiTooltipStat {
  label: string;
  value: string;
  accent?: boolean;
}

export interface UiTooltipContent {
  title: string;
  glyph: string;
  glyphColor?: string;
  description: string;
  stats: UiTooltipStat[];
  footer?: string;
}

export type UiTooltipTarget =
  | { kind: 'spell'; id: string }
  | { kind: 'blueprint'; id: string }
  | { kind: 'tool'; id: string };

export function selectUiTooltip(snapshot: Snapshot, target: UiTooltipTarget): UiTooltipContent | null {
  switch (target.kind) {
    case 'spell':
      return selectSpellTooltip(snapshot, target.id);
    case 'blueprint':
      return selectBlueprintTooltip(snapshot, target.id);
    case 'tool':
      return selectBuildToolTooltip(snapshot, target.id);
  }
}

function selectSpellTooltip(snapshot: Snapshot, spellId: string): UiTooltipContent | null {
  const spell = getSpell(spellId);
  if (!spell || spell.autoCast) return null;

  const { game } = snapshot;
  const inAttack = game.scene === 'run' && game.phase === 'attack';
  const hotkey = listHotbarSpells(game).findIndex((s) => s.id === spellId) + 1;
  const stats: UiTooltipStat[] = [
    { label: 'Mana', value: String(spell.manaCost), accent: true },
    { label: 'Cooldown', value: `${spell.cooldown}s` },
    { label: 'Range', value: `${spell.range} cells` },
    { label: 'Damage', value: String(spell.damage) },
  ];

  if (spell.id === 'blizzard') {
    stats.push({ label: 'Area', value: 'Diamond, radius 2' });
  } else if (spell.aoeRadius != null && spell.aoeRadius > 0) {
    const size = spell.aoeRadius * 2 + 1;
    stats.push({ label: 'Area', value: `${size}×${size} blast` });
  }

  stats.push({ label: 'Targeting', value: 'Click grid cell' });

  let footer: string | undefined;
  if (!inAttack) {
    footer = 'Available during attack · mana refills each wave';
  } else if (spellCooldownRemaining(game, spellId) > 0) {
    footer = `On cooldown (${spellCooldownRemaining(game, spellId).toFixed(1)}s)`;
  } else if (game.player.mana < spell.manaCost) {
    footer = 'Not enough mana';
  } else if (hotkey > 0) {
    footer = `Press ${hotkey} or click slot, then click the grid to cast`;
  }

  return {
    title: spell.name,
    glyph: spell.glyph,
    glyphColor: '#f6ad55',
    description: spell.description,
    stats,
    footer,
  };
}

function selectBlueprintTooltip(snapshot: Snapshot, blueprintId: string): UiTooltipContent | null {
  const blueprint =
    getBlueprint(blueprintId) ?? getInfraBlueprint(blueprintId) ?? getFortificationBlueprint(blueprintId);
  if (!blueprint) return null;

  const { remaining } = selectBuildEconomy(snapshot);
  const affordable = canAffordResources(remaining, blueprint.cost);
  const isFort = blueprint.category === 'fortification';
  const behavior = getRoomBehavior(blueprintId);
  const fortPlace = isFort ? getFortificationPlacementHint(blueprintId) : undefined;
  const fortEffect = isFort ? getFortificationMechanics(blueprintId) : undefined;

  const stats: UiTooltipStat[] = [
    { label: 'Cost', value: formatResourceCost(blueprint.cost), accent: true },
  ];
  if (!isFort) {
    stats.push({ label: 'HP', value: String(blueprint.baseHp) });
    stats.push({ label: 'Size', value: `${blueprint.size.w}×${blueprint.size.h}` });
  }
  if (fortPlace) {
    stats.push({ label: 'Place', value: fortPlace });
  }
  stats.push({ label: 'Affordable', value: affordable ? 'Yes' : 'No' });
  if (behavior) {
    stats.push({ label: 'Effect', value: behavior.mechanics, accent: true });
  } else if (fortEffect) {
    stats.push({ label: 'Effect', value: fortEffect, accent: true });
  }

  return {
    title: blueprint.name,
    glyph: blueprint.glyph,
    glyphColor: blueprint.color,
    description: blueprint.description,
    stats,
    footer: affordable ? 'Click to select · drag to place' : 'Not enough resources remaining',
  };
}

function selectBuildToolTooltip(snapshot: Snapshot, toolId: string): UiTooltipContent | null {
  const tool = getBuildTool(toolId);
  if (!tool) return null;

  const inSelect = snapshot.view.selectedBlueprintId === null;

  return {
    title: tool.name,
    glyph: tool.glyph,
    description: tool.description,
    stats: [{ label: 'Mode', value: inSelect ? 'Active' : 'Inactive', accent: inSelect }],
    footer: 'Click to enter select mode',
  };
}
