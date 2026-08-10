import type { Blueprint } from './types';
import { WEAR_HP_SCALE } from '@/config/constants';

/** Load-bearing framing blueprints (spires / buttresses). */
export const STRUCTURE_BLUEPRINTS: Blueprint[] = [
  {
    id: 'stem',
    name: 'Spire Block',
    glyph: 'I',
    color: '#5a6b8c',
    size: { w: 1, h: 1 },
    cost: { stone: 3 },
    baseHp: 20 * WEAR_HP_SCALE,
    category: 'structure',
    description:
      'A 1×1 framing block. Stack upward to reach the wizard perch. Must sit on ground or framing directly below — no overhang. Costs stone; subject to weathering and climber abrasion.',
  },
  {
    id: 'buttress2',
    name: 'Buttress (2)',
    glyph: 'B',
    color: '#8c6b5a',
    size: { w: 2, h: 1 },
    cost: { metal: 6 },
    baseHp: 35,
    category: 'structure',
    description: 'A wide 2×1 framing platform. Can cantilever one step beyond support for flexible tower shapes. Costs metal.',
  },
  {
    id: 'buttress3',
    name: 'Buttress (3)',
    glyph: 'B',
    color: '#7a5a4a',
    size: { w: 3, h: 1 },
    cost: { metal: 8 },
    baseHp: 45,
    category: 'structure',
    description: 'A wide 3×1 framing platform. Same cantilever rules as the smaller buttress, with more HP. Costs metal.',
  },
];

/** Functional rooms that overlay structure. */
export const ROOM_BLUEPRINTS: Blueprint[] = [
  {
    id: 'turretRoom',
    name: 'Turret Room',
    glyph: '*',
    color: '#f6ad55',
    size: { w: 1, h: 1 },
    cost: { souls: 10 },
    baseHp: 18,
    category: 'room',
    description: 'Auto-fires at nearby climbers during attack. Costs 1 mana per shot. Costs souls.',
  },
  {
    id: 'flameTurretRoom',
    name: 'Flame Turret',
    glyph: 'F',
    color: '#e53e3e',
    size: { w: 1, h: 1 },
    cost: { souls: 12 },
    baseHp: 18,
    category: 'room',
    description:
      'Charges, then blasts open sides to Kindle climbers for fire-spell bursts. Needs a fire pipe from a Forge. Costs 1 mana per blast and souls.',
  },
  {
    id: 'forgeRoom',
    name: 'Forge',
    glyph: 'G',
    color: '#c05621',
    size: { w: 1, h: 1 },
    cost: { metal: 14 },
    baseHp: 22,
    category: 'room',
    passable: false,
    description:
      'Seeds fire into adjacent pipes. Supports Flame Turrets on the same fire-pipe network. Costs metal.',
  },
  {
    id: 'guardroomRoom',
    name: 'Guardroom',
    glyph: 'A',
    color: '#718096',
    size: { w: 1, h: 1 },
    cost: { stone: 9 },
    baseHp: 20 * WEAR_HP_SCALE,
    category: 'room',
    passable: true,
    housing: 'guardroom',
    description: 'Recruit soldiers during build. They deploy through stairs to slots when the wave starts. Costs stone.',
  },
  {
    id: 'chamberRoom',
    name: 'Chamber',
    glyph: 'C',
    color: '#9f7aea',
    size: { w: 1, h: 1 },
    cost: { souls: 12 },
    baseHp: 18,
    category: 'room',
    passable: true,
    housing: 'chamber',
    description: 'House magi. They staff mana springs during attack when stairs connect them. Costs souls.',
  },
  {
    id: 'quartersRoom',
    name: 'Quarters',
    glyph: 'Q',
    color: '#dd6b20',
    size: { w: 1, h: 1 },
    cost: { stone: 8 },
    baseHp: 22 * WEAR_HP_SCALE,
    category: 'room',
    passable: true,
    housing: 'quarters',
    description:
      'House laborers. They path to damaged rooms and framing during attack, hand-pump water, and harvest stone in the underground mine. Costs stone.',
  },
  {
    id: 'slotRoom',
    name: 'Slot',
    glyph: 'S',
    color: '#805ad5',
    size: { w: 1, h: 1 },
    cost: { stone: 11 },
    baseHp: 18 * WEAR_HP_SCALE,
    category: 'room',
    passable: true,
    description: 'Station soldiers here during attack. Allocate headcount from guardrooms in build phase. Costs stone.',
  },
  {
    id: 'boilerRoom',
    name: 'Boiler',
    glyph: 'H',
    color: '#c05621',
    size: { w: 1, h: 2 },
    cost: { metal: 16 },
    baseHp: 22,
    category: 'room',
    passable: false,
    description:
      '1×2 steam plant. Needs a ground-water pipe in and a steam pipe out. Drains mana while producing steam. Costs metal.',
  },
  {
    id: 'steamTurretRoom',
    name: 'Steam Turret',
    glyph: 'T',
    color: '#dd6b20',
    size: { w: 1, h: 1 },
    cost: { metal: 14 },
    baseHp: 20,
    category: 'room',
    passable: false,
    description:
      'Charges from boiler steam, then dumps a wide exterior blast. Needs an adjacent steam pipe. Costs metal.',
  },
  {
    id: 'manaSpringRoom',
    name: 'Mana Spring',
    glyph: 'M',
    color: '#3182ce',
    size: { w: 2, h: 2 },
    cost: { souls: 28 },
    baseHp: 30,
    category: 'room',
    passable: true,
    description:
      '2×2 spring. Needs ground-water pipe access and stationed magi. Regenerates mana during attack. Costs souls.',
  },
  {
    id: 'hydrantRoom',
    name: 'Hydrant',
    glyph: 'Y',
    color: '#2b6cb0',
    size: { w: 1, h: 1 },
    cost: { metal: 12 },
    baseHp: 18,
    category: 'room',
    passable: false,
    description:
      'Sprays water on its sides during attack. Needs a ground-water pipe. Sheets flow down and puddle on flats — soaks climbers. Costs metal.',
  },
  {
    id: 'pumpRoom',
    name: 'Water Pump',
    glyph: 'P',
    color: '#2c7a7b',
    size: { w: 1, h: 1 },
    cost: { metal: 10 },
    baseHp: 20,
    category: 'room',
    passable: false,
    description:
      'Extends how high pipe water can reach. Stack pumps (and keep a hand-pump laborer for the base band) to feed springs and boilers up the tower. Costs metal.',
  },
];

export const BLUEPRINTS: Blueprint[] = [...STRUCTURE_BLUEPRINTS, ...ROOM_BLUEPRINTS];

export const STARTING_BLUEPRINT_IDS = BLUEPRINTS.map((b) => b.id);

/** Blueprint ids whose footprints take stone wear (weathering + abrasion). */
export const STONE_BUILT_BLUEPRINT_IDS = new Set([
  'stem',
  'staircase',
  'guardroomRoom',
  'quartersRoom',
  'slotRoom',
]);

export function isStoneBuiltBlueprint(blueprintId: string): boolean {
  return STONE_BUILT_BLUEPRINT_IDS.has(blueprintId);
}

export function getBlueprint(id: string): Blueprint | undefined {
  return BLUEPRINTS.find((b) => b.id === id);
}

export function isStructureBlueprint(blueprint: Blueprint): boolean {
  return blueprint.category === 'structure';
}

export function isRoomBlueprint(blueprint: Blueprint): boolean {
  return blueprint.category === 'room' || (!blueprint.category && !blueprint.infraKind);
}

export function isButtressBlueprint(blueprint: Blueprint): boolean {
  return isStructureBlueprint(blueprint) && blueprint.size.w >= 2;
}
