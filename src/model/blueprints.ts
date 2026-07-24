import type { Blueprint } from './types';

/** Load-bearing framing blueprints (spires / buttresses). */
export const STRUCTURE_BLUEPRINTS: Blueprint[] = [
  {
    id: 'stem',
    name: 'Spire Block',
    glyph: 'I',
    color: '#5a6b8c',
    size: { w: 1, h: 1 },
    cost: 3,
    baseHp: 20,
    category: 'structure',
    description:
      'A 1×1 framing block. Stack upward to reach the wizard perch. Must sit on ground or framing directly below — no overhang.',
  },
  {
    id: 'buttress2',
    name: 'Buttress (2)',
    glyph: 'B',
    color: '#8c6b5a',
    size: { w: 2, h: 1 },
    cost: 6,
    baseHp: 35,
    category: 'structure',
    description: 'A wide 2×1 framing platform. Can cantilever one step beyond support for flexible tower shapes.',
  },
  {
    id: 'buttress3',
    name: 'Buttress (3)',
    glyph: 'B',
    color: '#7a5a4a',
    size: { w: 3, h: 1 },
    cost: 8,
    baseHp: 45,
    category: 'structure',
    description: 'A wide 3×1 framing platform. Same cantilever rules as the smaller buttress, with more HP.',
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
    cost: 10,
    baseHp: 18,
    category: 'room',
    description: 'Auto-fires at nearby climbers during attack. Costs 1 mana per shot.',
  },
  {
    id: 'goldMineRoom',
    name: 'Gold Mine',
    glyph: '$',
    color: '#ecc94b',
    size: { w: 1, h: 1 },
    cost: 8,
    baseHp: 15,
    category: 'room',
    description: 'Passive income when you survive a wave.',
  },
  {
    id: 'guardroomRoom',
    name: 'Guardroom',
    glyph: 'A',
    color: '#718096',
    size: { w: 1, h: 1 },
    cost: 9,
    baseHp: 20,
    category: 'room',
    passable: true,
    housing: 'guardroom',
    description: 'Recruit soldiers during build. They deploy through stairs to slots when the wave starts.',
  },
  {
    id: 'chamberRoom',
    name: 'Chamber',
    glyph: 'C',
    color: '#9f7aea',
    size: { w: 1, h: 1 },
    cost: 12,
    baseHp: 18,
    category: 'room',
    passable: true,
    housing: 'chamber',
    description: 'House magi. They staff mana springs during attack when stairs connect them.',
  },
  {
    id: 'quartersRoom',
    name: 'Quarters',
    glyph: 'Q',
    color: '#dd6b20',
    size: { w: 1, h: 1 },
    cost: 8,
    baseHp: 22,
    category: 'room',
    passable: true,
    housing: 'quarters',
    description: 'House laborers. They path to damaged rooms and framing during attack and repair HP.',
  },
  {
    id: 'slotRoom',
    name: 'Slot',
    glyph: 'S',
    color: '#805ad5',
    size: { w: 1, h: 1 },
    cost: 11,
    baseHp: 18,
    category: 'room',
    passable: true,
    description: 'Station soldiers here during attack. Allocate headcount from guardrooms in build phase.',
  },
  {
    id: 'boilerRoom',
    name: 'Boiler',
    glyph: 'H',
    color: '#c05621',
    size: { w: 1, h: 2 },
    cost: 16,
    baseHp: 22,
    category: 'room',
    passable: false,
    description:
      '1×2 steam plant. Needs a ground-water pipe in and a steam pipe out. Drains mana while producing steam.',
  },
  {
    id: 'steamTurretRoom',
    name: 'Steam Turret',
    glyph: 'T',
    color: '#dd6b20',
    size: { w: 1, h: 1 },
    cost: 14,
    baseHp: 20,
    category: 'room',
    passable: false,
    description:
      'Charges from boiler steam, then dumps a wide exterior blast. Needs an adjacent steam pipe.',
  },
  {
    id: 'manaSpringRoom',
    name: 'Mana Spring',
    glyph: 'M',
    color: '#3182ce',
    size: { w: 2, h: 2 },
    cost: 28,
    baseHp: 30,
    category: 'room',
    passable: true,
    description:
      '2×2 spring. Needs ground-water pipe access and stationed magi. Regenerates mana during attack.',
  },
];

export const BLUEPRINTS: Blueprint[] = [...STRUCTURE_BLUEPRINTS, ...ROOM_BLUEPRINTS];

export const STARTING_BLUEPRINT_IDS = BLUEPRINTS.map((b) => b.id);

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
