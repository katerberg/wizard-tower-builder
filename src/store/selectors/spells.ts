import { roomCells } from '@/calculations/grid';
import {
  canCastSpell,
  enemyAtCell,
  getSpell,
  gridLine,
  tornadoGridLine,
  HOTBAR_SLOT_COUNT,
  listHotbarSpells,
  spellCooldownRemaining,
  geyserColumnCells,
} from '@/model/spells';
import { MAX_CHARGE } from '@/model/spells/earth/constants';
import { aoeCells } from '@/model/spells/fire/fireball';
import { roomAt } from '@/model/tower';
import type { Cell } from '@/model/types';
import type { Snapshot } from '../store';

export interface ManaState {
  current: number;
  max: number;
  /** Display string rounded to the nearest tenth. */
  label: string;
}

export function selectMana(snapshot: Snapshot): ManaState {
  const { player } = snapshot.game;
  const current = Math.round(player.mana * 10) / 10;
  const max = player.maxMana;
  return {
    current,
    max,
    label: `${current.toFixed(1)} / ${max}`,
  };
}

export interface ChargeState {
  current: number;
  max: number;
  fortified: boolean;
  label: string;
}

export function selectEarthCharge(snapshot: Snapshot): ChargeState {
  const { game } = snapshot;
  const current = game.earthCharge ?? 0;
  const max = MAX_CHARGE;
  return {
    current,
    max,
    fortified: game.fortified === true,
    label: `${current} / ${max}${game.fortified ? ' · Fortified' : ''}`,
  };
}

export interface SpellBarSlot {
  hotkey: number;
  id: string | null;
  name: string | null;
  glyph: string | null;
  manaCost: number | null;
  cooldownRemaining: number;
  selected: boolean;
  enabled: boolean;
  disabledReason: string | null;
  empty: boolean;
}

export function selectSpellBar(snapshot: Snapshot): SpellBarSlot[] {
  const { game, view } = snapshot;
  if (game.scene !== 'run') return [];

  const inAttack = game.phase === 'attack';
  const spells = listHotbarSpells(game);
  const slots: SpellBarSlot[] = [];

  for (let i = 0; i < HOTBAR_SLOT_COUNT; i++) {
    const spell = spells[i];
    const hotkey = i + 1;
    if (!spell) {
      slots.push({
        hotkey, id: null, name: null, glyph: null, manaCost: null, cooldownRemaining: 0,
        selected: false, enabled: false, disabledReason: null, empty: true,
      });
      continue;
    }

    if (!inAttack) {
      slots.push({
        hotkey, id: spell.id, name: spell.name, glyph: spell.glyph, manaCost: spell.manaCost,
        cooldownRemaining: 0, selected: false, enabled: false, disabledReason: null, empty: false,
      });
      continue;
    }

    const onCooldown = spellCooldownRemaining(game, spell.id) > 0;
    const noMana = game.player.mana < spell.manaCost;
    const check = canCastSpell(game, spell.id);
    let disabledReason: string | null = null;
    if (!check.ok && (check.reason === 'concentrating' || check.reason === 'no_charge')) {
      disabledReason = check.reason === 'no_charge' ? 'no charge' : 'fortified';
    } else if (onCooldown) disabledReason = 'cooldown';
    else if (noMana) disabledReason = 'no mana';

    slots.push({
      hotkey, id: spell.id, name: spell.name, glyph: spell.glyph, manaCost: spell.manaCost,
      cooldownRemaining: spellCooldownRemaining(game, spell.id),
      selected: view.selectedSpellId === spell.id,
      enabled: disabledReason == null,
      disabledReason,
      empty: false,
    });
  }

  return slots;
}

export interface CastPreview {
  cells: Cell[];
  valid: boolean;
  reason: string;
}

export function selectCastPreview(snapshot: Snapshot): CastPreview | null {
  const { game, view } = snapshot;
  if (game.scene !== 'run' || game.phase !== 'attack') return null;
  const spellId = view.selectedSpellId;
  if (!spellId || !view.hoveredCell) return null;

  const spell = getSpell(spellId);
  if (!spell || spell.autoCast) return null;

  if (spell.targeting === 'gridPoint') {
    const result = canCastSpell(game, spellId, { kind: 'cell', cell: view.hoveredCell });
    const cells = spell.previewCells
      ? spell.previewCells(game, view.hoveredCell)
      : aoeCells(view.hoveredCell, spell.aoeRadius ?? 0);
    return { cells, valid: result.ok, reason: result.ok ? 'ok' : result.reason };
  }

  if (spell.targeting === 'puddle') {
    const result = canCastSpell(game, spellId, { kind: 'cell', cell: view.hoveredCell });
    const preview = spell.previewCells?.(game, view.hoveredCell) ?? geyserColumnCells(view.hoveredCell);
    return { cells: result.ok ? preview : [view.hoveredCell], valid: result.ok, reason: result.ok ? 'ok' : result.reason };
  }

  if (spell.targeting === 'trapAdjacent') {
    const result = canCastSpell(game, spellId, { kind: 'cell', cell: view.hoveredCell });
    return { cells: [view.hoveredCell], valid: result.ok, reason: result.ok ? 'ok' : result.reason };
  }

  if (spell.targeting === 'room') {
    const result = canCastSpell(game, spellId, { kind: 'cell', cell: view.hoveredCell });
    const room = roomAt(game.tower, view.hoveredCell.col, view.hoveredCell.row);
    const cells = room ? roomCells(room.origin, room.size) : [view.hoveredCell];
    return { cells, valid: result.ok, reason: result.ok ? 'ok' : result.reason };
  }

  if (spell.targeting === 'enemy') {
    const enemy = enemyAtCell(game, view.hoveredCell);
    const result = enemy
      ? canCastSpell(game, spellId, { kind: 'enemy', enemyId: enemy.id })
      : { ok: false as const, reason: 'no_target' as const };
    return { cells: enemy ? [view.hoveredCell] : [], valid: result.ok, reason: result.ok ? 'ok' : result.reason };
  }

  if (spell.targeting === 'segment') {
    if (!view.castAnchor) {
      const result = canCastSpell(game, spellId, { kind: 'cell', cell: view.hoveredCell });
      return { cells: [view.hoveredCell], valid: result.ok, reason: result.ok ? 'ok' : result.reason };
    }
    const line = gridLine(view.castAnchor, view.hoveredCell);
    const result = line
      ? canCastSpell(game, spellId, { kind: 'segment', from: view.castAnchor, to: view.hoveredCell })
      : { ok: false as const, reason: 'invalid_segment' as const };
    return { cells: line ?? [view.castAnchor, view.hoveredCell], valid: result.ok, reason: result.ok ? 'ok' : result.reason };
  }

  if (spell.targeting === 'airSegment') {
    if (!view.castAnchor) {
      const result = canCastSpell(game, spellId, { kind: 'cell', cell: view.hoveredCell });
      return {
        cells: [view.hoveredCell, { col: view.hoveredCell.col, row: view.hoveredCell.row + 1 }],
        valid: result.ok,
        reason: result.ok ? 'ok' : result.reason,
      };
    }
    const line = tornadoGridLine(view.castAnchor, view.hoveredCell);
    const previewCells = line
      ? line.flatMap((c) => [c, { col: c.col, row: c.row + 1 }])
      : [view.castAnchor, view.hoveredCell];
    const result = line
      ? canCastSpell(game, spellId, { kind: 'segment', from: view.castAnchor, to: view.hoveredCell })
      : { ok: false as const, reason: 'invalid_segment' as const };
    return { cells: previewCells, valid: result.ok, reason: result.ok ? 'ok' : result.reason };
  }

  return null;
}

export function selectCanCastSpell(
  snapshot: Snapshot,
  spellId: string,
  cell: Cell,
): { valid: boolean; reason: string } {
  const result = canCastSpell(snapshot.game, spellId, { kind: 'cell', cell });
  return { valid: result.ok, reason: result.ok ? 'ok' : result.reason };
}
