import type { EnemyTemplate, MovementProfile } from './types';

// v1 crawlers: under_overhang so a path to the wizard always exists on T-towers.
const underOverhang: MovementProfile = {
  kind: 'under_overhang',
  canPassUnderOverhang: true,
  canAttackOverhang: false,
  canFly: false,
  canTransferFaces: false,
};

const fly: MovementProfile = {
  kind: 'fly',
  canPassUnderOverhang: false,
  canAttackOverhang: false,
  canFly: true,
  canTransferFaces: false,
};

/** Small crawler baseline speed; melee fliers use ~1.3× this. */
export const SMALL_CRAWLER_SPEED = 2.2;

export const ENEMY_TEMPLATES: Record<string, EnemyTemplate> = {
  swarm: {
    id: 'swarm',
    type: 'Swarm',
    glyph: 's',
    color: '#fc8181',
    stats: { strength: 2, dexterity: 2, maxHp: 4 },
    speed: SMALL_CRAWLER_SPEED,
    currencyReward: 1,
    movement: underOverhang,
    sizeTier: 'small',
  },
  skirmisher: {
    id: 'skirmisher',
    type: 'Skirmisher',
    glyph: 'k',
    color: '#76e4f7',
    stats: { strength: 2, dexterity: 5, maxHp: 3 },
    speed: 2.8,
    currencyReward: 1,
    movement: underOverhang,
    sizeTier: 'small',
  },
  elite: {
    id: 'elite',
    type: 'Elite',
    glyph: 'E',
    color: '#f6ad55',
    stats: { strength: 7, dexterity: 1, maxHp: 28 },
    speed: 1.2,
    currencyReward: 4,
    movement: underOverhang,
    sizeTier: 'medium',
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
    sizeTier: 'large',
  },
  /** Fast melee flier — early tease / mid packs. */
  striker: {
    id: 'striker',
    type: 'Striker',
    glyph: 'f',
    color: '#9f7aea',
    stats: { strength: 3, dexterity: 4, maxHp: 3 },
    speed: SMALL_CRAWLER_SPEED * 1.3,
    currencyReward: 3,
    movement: fly,
    sizeTier: 'small',
  },
  /** Contact burst, then self-remove. */
  kamikaze: {
    id: 'kamikaze',
    type: 'Kamikaze',
    glyph: 'z',
    color: '#ed64a6',
    stats: { strength: 6, dexterity: 2, maxHp: 2 },
    speed: SMALL_CRAWLER_SPEED * 1.4,
    currencyReward: 4,
    movement: fly,
    sizeTier: 'small',
    kamikaze: true,
  },
  /** Late-game hover launcher (Starcraft carrier fantasy). */
  carrier: {
    id: 'carrier',
    type: 'Carrier',
    glyph: 'C',
    color: '#667eea',
    stats: { strength: 4, dexterity: 1, maxHp: 40 },
    speed: 1.0,
    currencyReward: 12,
    movement: fly,
    sizeTier: 'medium',
    carrier: true,
  },
  /** Weaker kamikaze spawned by carriers; dies after 3 macro cells. */
  carrierKamikaze: {
    id: 'carrierKamikaze',
    type: 'Drone',
    glyph: '·',
    color: '#b794f4',
    stats: { strength: 3, dexterity: 3, maxHp: 1 },
    speed: SMALL_CRAWLER_SPEED * 1.5,
    currencyReward: 1,
    movement: fly,
    sizeTier: 'small',
    kamikaze: true,
  },
};

export function getEnemyTemplate(id: string): EnemyTemplate | undefined {
  return ENEMY_TEMPLATES[id];
}
