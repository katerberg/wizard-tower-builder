import type { Blueprint, InfraKind } from './types';

/** Infrastructure blueprints painted on the infra layer (same cell grid as rooms). */
export const INFRA_BLUEPRINTS: Blueprint[] = [
  {
    id: 'pipe',
    name: 'Pipe',
    glyph: '~',
    color: '#4299e1',
    size: { w: 1, h: 1 },
    cost: { metal: 1 },
    baseHp: 0,
    category: 'infra',
    infraKind: 'pipe',
    description: 'Thin logistics line on structure. Empty cells auto-place a Spire Block when legal. Costs metal.',
  },
  {
    id: 'elevator',
    name: 'Elevator',
    glyph: '=',
    color: '#ecc94b',
    size: { w: 1, h: 1 },
    cost: { metal: 6, souls: 2 },
    baseHp: 0,
    category: 'infra',
    infraKind: 'elevator',
    description:
      'Fast vertical shaft. Contiguous cells in a column form one shaft with a shared car (up to 6 staff). Empty cells auto-place a Spire Block when legal. Costs metal and souls.',
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
      // Stairs are auto-generated; no buildable blueprint.
      return '';
    case 'pipe':
      return 'pipe';
    case 'elevator':
      return 'elevator';
  }
}
