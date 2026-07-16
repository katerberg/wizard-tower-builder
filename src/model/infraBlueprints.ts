import type { Blueprint, InfraKind } from './types';

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
    description:
      'Leads up to the floor above (staff can enter a room from the stair below). Empty cells auto-place a Spire Block when legal.',
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
  {
    id: 'elevator',
    name: 'Elevator',
    glyph: '=',
    color: '#ecc94b',
    size: { w: 1, h: 1 },
    cost: 8,
    baseHp: 0,
    category: 'infra',
    infraKind: 'elevator',
    description:
      'Fast vertical shaft. Contiguous cells in a column form one shaft with a shared car (up to 6 staff). Empty cells auto-place a Spire Block when legal.',
  },
];

export function getInfraBlueprint(id: string): Blueprint | undefined {
  return INFRA_BLUEPRINTS.find((b) => b.id === id);
}

export function isInfraBlueprint(id: string): boolean {
  return INFRA_BLUEPRINTS.some((b) => b.id === id);
}

export function infraBlueprintIdForKind(kind: InfraKind): string {
  switch (kind) {
    case 'stair':
      return 'staircase';
    case 'pipe':
      return 'pipe';
    case 'elevator':
      return 'elevator';
  }
}
