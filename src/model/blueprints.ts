import type { Blueprint } from './types';

export const BLUEPRINTS: Blueprint[] = [
  {
    id: 'stem',
    name: 'Spire Block',
    glyph: 'I',
    color: '#5a6b8c',
    size: { w: 1, h: 1 },
    cost: 3,
    baseHp: 20,
  },
  {
    id: 'buttress2',
    name: 'Buttress (2)',
    glyph: 'B',
    color: '#8c6b5a',
    size: { w: 2, h: 1 },
    cost: 6,
    baseHp: 35,
  },
  {
    id: 'buttress3',
    name: 'Buttress (3)',
    glyph: 'B',
    color: '#7a5a4a',
    size: { w: 3, h: 1 },
    cost: 8,
    baseHp: 45,
  },
  {
    id: 'turretRoom',
    name: 'Turret Room',
    glyph: '*',
    color: '#f6ad55',
    size: { w: 1, h: 1 },
    cost: 10,
    baseHp: 18,
  },
  {
    id: 'goldMineRoom',
    name: 'Gold Mine',
    glyph: '$',
    color: '#ecc94b',
    size: { w: 1, h: 1 },
    cost: 8,
    baseHp: 15,
  },
];

export const STARTING_BLUEPRINT_IDS = BLUEPRINTS.map((b) => b.id);

export function getBlueprint(id: string): Blueprint | undefined {
  return BLUEPRINTS.find((b) => b.id === id);
}

export function isButtressBlueprint(blueprint: Blueprint): boolean {
  return blueprint.size.w >= 2;
}
