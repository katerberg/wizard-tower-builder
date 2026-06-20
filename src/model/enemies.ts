import type { EnemyTemplate, MovementProfile } from './types';

// v1: every enemy uses the under_overhang profile so a path to the wizard
// always exists, even on T-shaped towers.
const underOverhang: MovementProfile = {
  kind: 'under_overhang',
  canPassUnderOverhang: true,
  canAttackOverhang: false,
  canFly: false,
  canTransferFaces: false,
};

export const ENEMY_TEMPLATES: Record<string, EnemyTemplate> = {
  goblin: {
    id: 'goblin',
    type: 'Goblin',
    glyph: 'g',
    color: '#fc8181',
    stats: { strength: 4, dexterity: 3, maxHp: 12 },
    speed: 3,
    currencyReward: 2,
    movement: underOverhang,
  },
  brute: {
    id: 'brute',
    type: 'Brute',
    glyph: 'B',
    color: '#f6ad55',
    stats: { strength: 9, dexterity: 1, maxHp: 34 },
    speed: 1.5,
    currencyReward: 5,
    movement: underOverhang,
  },
  wisp: {
    id: 'wisp',
    type: 'Wisp',
    glyph: 'w',
    color: '#76e4f7',
    stats: { strength: 3, dexterity: 6, maxHp: 8 },
    speed: 4.5,
    currencyReward: 3,
    movement: underOverhang,
  },
};

export function getEnemyTemplate(id: string): EnemyTemplate | undefined {
  return ENEMY_TEMPLATES[id];
}
