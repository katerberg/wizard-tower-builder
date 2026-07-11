import type { Cell, Enemy, GameMessageKind, GameState } from '../types';

export type SpellTargeting = 'gridPoint' | 'autoNearest' | 'enemy' | 'segment' | 'airSegment' | 'trapAdjacent' | 'self';

export type SpellTarget =
  | { kind: 'cell'; cell: Cell }
  | { kind: 'enemy'; enemyId: string }
  | { kind: 'segment'; from: Cell; to: Cell }
  | { kind: 'self' };

export type CastFailureReason =
  | 'wrong_phase'
  | 'unknown_spell'
  | 'no_mana'
  | 'on_cooldown'
  | 'out_of_range'
  | 'no_target'
  | 'manual_only'
  | 'invalid_placement'
  | 'invalid_segment';

export interface SpellCastContext {
  state: GameState;
  spellName: string;
  damageEnemy: (enemy: Enemy, damage: number, dexterity?: number) => void;
  damageWizard: (damage: number) => void;
  applyFireDamage: (enemy: Enemy, damage: number, dexterity?: number) => void;
  applyWindDamage: (enemy: Enemy, damage: number) => void;
  log: (text: string, kind?: GameMessageKind) => void;
}

export interface SpellDef {
  id: string;
  name: string;
  glyph: string;
  description: string;
  manaCost: number;
  cooldown: number;
  targeting: SpellTargeting;
  /** Max grid distance from the wizard perch for targeted spells. */
  range: number;
  damage: number;
  dexterity?: number;
  /** When true, fires automatically each cooldown without player input. */
  autoCast?: boolean;
  /** Chebyshev radius for gridPoint AoE (1 = 3×3). */
  aoeRadius?: number;
  cast: (ctx: SpellCastContext, target: SpellTarget) => void;
}

export type CastCheckResult =
  | { ok: true }
  | { ok: false; reason: CastFailureReason };
