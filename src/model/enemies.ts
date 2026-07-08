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
  swarm: {
    id: 'swarm',
    type: 'Swarm',
    glyph: 's',
    color: '#fc8181',
    stats: { strength: 2, dexterity: 2, maxHp: 4 },
    speed: 2,
    currencyReward: 1,
    movement: underOverhang,
    sizeTier: 'swarm',
  },
  skirmisher: {
    id: 'skirmisher',
    type: 'Skirmisher',
    glyph: 'k',
    color: '#76e4f7',
    stats: { strength: 2, dexterity: 5, maxHp: 3 },
    speed: 3,
    currencyReward: 1,
    movement: underOverhang,
    sizeTier: 'swarm',
  },
  elite: {
    id: 'elite',
    type: 'Elite',
    glyph: 'E',
    color: '#f6ad55',
    stats: { strength: 7, dexterity: 1, maxHp: 28 },
    speed: 1,
    currencyReward: 4,
    movement: underOverhang,
    sizeTier: 'elite',
  },
  brute: {
    id: 'brute',
    type: 'Brute',
    glyph: 'B',
    color: '#e53e3e',
    stats: { strength: 11, dexterity: 0, maxHp: 55 },
    speed: 0.7,
    currencyReward: 8,
    movement: underOverhang,
    sizeTier: 'boss',
  },
};

export function getEnemyTemplate(id: string): EnemyTemplate | undefined {
  return ENEMY_TEMPLATES[id];
}
