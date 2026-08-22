import type { Blueprint } from './types';
import { WEAR_HP_SCALE } from '@/config/constants';

/** Load-bearing framing blueprints (spire blocks). */
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
      'A 1×1 framing block. Stack upward to reach the wizard perch. Must sit on ground or framing directly below until Cantilever Framing is researched. Costs stone; subject to weathering and climber abrasion.',
  },
  {
    id: 'scaffold',
    name: 'Scaffold',
    glyph: '#',
    color: '#4a5568',
    size: { w: 1, h: 1 },
    cost: {},
    baseHp: 20,
    category: 'structure',
    description: 'Temporary construction scaffold.',
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
    description: 'Auto-fires at nearby climbers during attack. Reserves 5 mana from pool cap per wave. Costs souls.',
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
  {
    id: 'researchRoom',
    name: 'Research Room',
    glyph: 'R',
    color: '#4a6fa5',
    size: { w: 2, h: 1 },
    cost: { souls: 8, stone: 6 },
    baseHp: 25,
    category: 'room',
    passable: true,
    description:
      'Magi stationed here advance the active research project during attack. Costs souls and stone.',
  },
  {
    id: 'leylineResearchRoom',
    name: 'Leyline Research',
    glyph: 'L',
    color: '#6b5b95',
    size: { w: 2, h: 1 },
    cost: { souls: 10, stone: 8 },
    baseHp: 25,
    category: 'room',
    passable: true,
    description:
      'Anchor a leyline band (rows 25 / 50 / 75). Staff a mage and clear a night to awaken the next school spell while the room stands.',
  },
  {
    id: 'storageRoom',
    name: 'Storage Room',
    glyph: 'V',
    color: '#d69e2e',
    size: { w: 1, h: 1 },
    cost: { stone: 10, metal: 4 },
    baseHp: 28,
    category: 'room',
    passable: true,
    description: 'Stores stone and metal (40 units combined). Build higher to shorten haul trips.',
  },
];

export const BLUEPRINTS: Blueprint[] = [...STRUCTURE_BLUEPRINTS, ...ROOM_BLUEPRINTS];

/**
 * Blueprints available at run start (research unlocks the rest).
 * Infra starters are listed in STARTING_INFRA_BLUEPRINT_IDS.
 */
export const STARTING_BLUEPRINT_IDS: string[] = [
  'stem',
  'quartersRoom',
  'guardroomRoom',
  'chamberRoom',
  'turretRoom',
  'researchRoom',
  'storageRoom',
];

/** Infra ids unlocked at run start (library filters these separately). */
export const STARTING_INFRA_BLUEPRINT_IDS: string[] = ['staircase'];

/** Room mods available without research. */
export const STARTING_MODIFICATION_IDS: string[] = ['spikes'];

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
