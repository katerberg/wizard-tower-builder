import type { Blueprint } from './types';

/** Infrastructure blueprints painted on the infra layer (same cell grid as rooms). */
export const INFRA_BLUEPRINTS: Blueprint[] = [
  {
    id: 'staircase',
    name: 'Staircase',
    glyph: '#',
    color: '#a0aec0',
    size: { w: 1, h: 1 },
    cost: 2,
    baseHp: 0,
    category: 'infra',
    infraKind: 'stair',
    description: 'Vertical path for soldiers between floors. Empty cells auto-place a Spire Block when legal.',
  },
  {
    id: 'pipe',
    name: 'Pipe',
    glyph: '~',
    color: '#4299e1',
    size: { w: 1, h: 1 },
    cost: 1,
    baseHp: 0,
    category: 'infra',
    infraKind: 'pipe',
    description: 'Thin logistics line on structure. Empty cells auto-place a Spire Block when legal.',
  },
];

export function getInfraBlueprint(id: string): Blueprint | undefined {
  return INFRA_BLUEPRINTS.find((b) => b.id === id);
}

export function isInfraBlueprint(id: string): boolean {
  return INFRA_BLUEPRINTS.some((b) => b.id === id);
}
