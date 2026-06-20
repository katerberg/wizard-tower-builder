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
    id: 'hall',
    name: 'Stabilizer Hall',
    glyph: 'H',
    color: '#6b5a8c',
    size: { w: 3, h: 1 },
    cost: 8,
    baseHp: 45,
  },
  {
    id: 'buttress',
    name: 'Buttress',
    glyph: 'B',
    color: '#8c6b5a',
    size: { w: 2, h: 1 },
    cost: 6,
    baseHp: 35,
  },
];

export const STARTING_BLUEPRINT_IDS = BLUEPRINTS.map((b) => b.id);

export function getBlueprint(id: string): Blueprint | undefined {
  return BLUEPRINTS.find((b) => b.id === id);
}
