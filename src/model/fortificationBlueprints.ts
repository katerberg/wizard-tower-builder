import type { Blueprint, FortificationId } from './types';

/** Shell fortification blueprints placed on exterior framing cells. */
export const FORTIFICATION_BLUEPRINTS: Blueprint[] = [
  {
    id: 'moat',
    name: 'Moat',
    glyph: '~',
    color: '#2c5282',
    size: { w: 1, h: 1 },
    cost: { stone: 6 },
    baseHp: 0,
    category: 'fortification',
    description:
      'Ground-edge ditch. Blocks crawler walk on adjacent empty ground — forces side climbs. Costs stone.',
  },
  {
    id: 'glacis',
    name: 'Glacis',
    glyph: '/',
    color: '#a0aec0',
    size: { w: 1, h: 1 },
    cost: { stone: 4 },
    baseHp: 0,
    category: 'fortification',
    description:
      'Sloped approach. Adjacent empty ground stays walkable but costs more to path through. Costs stone.',
  },
  {
    id: 'parapet',
    name: 'Parapet',
    glyph: '=',
    color: '#718096',
    size: { w: 1, h: 1 },
    cost: { stone: 5 },
    baseHp: 0,
    category: 'fortification',
    description:
      'Battlement edge. Blocks crawling across this cell’s top face — forces side routes. Costs stone.',
  },
  {
    id: 'cornice',
    name: 'Cornice',
    glyph: '¬',
    color: '#9b6b4a',
    size: { w: 1, h: 1 },
    cost: { stone: 5 },
    baseHp: 0,
    category: 'fortification',
    description:
      'Projecting ledge band. Denies under-overhang crawl beneath this cell. Costs stone.',
  },
  {
    id: 'stakes',
    name: 'Stakes',
    glyph: 'x',
    color: '#c05621',
    size: { w: 1, h: 1 },
    cost: { stone: 4, metal: 2 },
    baseHp: 0,
    category: 'fortification',
    description:
      'Approach stakes. Adjacent empty ground is slower and slightly costlier to path. Costs stone and metal.',
  },
  {
    id: 'barbican',
    name: 'Barbican',
    glyph: 'G',
    color: '#553c9a',
    size: { w: 1, h: 1 },
    cost: { stone: 8, metal: 2 },
    baseHp: 0,
    category: 'fortification',
    description:
      'Gatehouse funnel. Nearby wall climbs cost more; this cell’s exposed face stays cheap. Costs stone and metal.',
  },
];

export function getFortificationBlueprint(id: string): Blueprint | undefined {
  return FORTIFICATION_BLUEPRINTS.find((b) => b.id === id);
}

export function isFortificationBlueprint(id: string): boolean {
  return FORTIFICATION_BLUEPRINTS.some((b) => b.id === id);
}

export function isFortificationId(id: string): id is FortificationId {
  return FORTIFICATION_BLUEPRINTS.some((b) => b.id === id);
}
