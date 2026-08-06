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
    description: 'A ground-edge ditch that shoves climbers onto the walls.',
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
    description: 'A sloped approach that taxes the easy ground path without sealing it.',
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
    description: 'A battlement lip that taxes roof-running across the crown.',
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
    description: 'A projecting band that taxes under-overhang shortcuts.',
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
    description: 'Approach stakes that slow and tax the ground approach.',
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
    description: 'A gatehouse funnel that steers climbers onto one exposed face.',
  },
];

const FORTIFICATION_PLACE: Record<FortificationId, string> = {
  moat: 'Ground-row exterior framing',
  glacis: 'Ground-row exterior framing',
  parapet: 'Exterior framing with exposed top',
  cornice: 'Exterior framing with empty cell below',
  stakes: 'Ground-row exterior framing',
  barbican: 'Exterior framing with exposed left or right wall',
};

const FORTIFICATION_MECHANICS: Record<FortificationId, string> = {
  moat: 'Adjacent empty ground high path cost + strong slow (never seals)',
  glacis: 'Adjacent empty ground high path cost',
  parapet: 'Taxes onTop crawl across this cell’s top face',
  cornice: 'Taxes under-overhang crawl beneath this cell',
  stakes: 'Adjacent empty ground slower and mildly costlier',
  barbican: 'Nearby wall climbs costly; this cell’s exposed face stays cheap',
};

export function getFortificationBlueprint(id: string): Blueprint | undefined {
  return FORTIFICATION_BLUEPRINTS.find((b) => b.id === id);
}

export function isFortificationBlueprint(id: string): boolean {
  return FORTIFICATION_BLUEPRINTS.some((b) => b.id === id);
}

export function isFortificationId(id: string): id is FortificationId {
  return FORTIFICATION_BLUEPRINTS.some((b) => b.id === id);
}

export function getFortificationPlacementHint(id: string): string | undefined {
  return isFortificationId(id) ? FORTIFICATION_PLACE[id] : undefined;
}

export function getFortificationMechanics(id: string): string | undefined {
  return isFortificationId(id) ? FORTIFICATION_MECHANICS[id] : undefined;
}
