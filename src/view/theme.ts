/** Canvas / HUD presentation tokens (not balance). */

export const symbols = {
  wizard: '@',
  ground: '=',
  empty: '.',
} as const;

export const colors = {
  background: '#0d1117',
  grid: '#1f2630',
  ground: '#3a2e22',
  room: '#4a5568',
  roomStroke: '#9aa5b1',
  ghostValid: '#2f855a',
  ghostInvalid: '#ff3b3b',
  spellValid: '#dd6b20',
  spellInvalid: '#742a2a',
  spellAim: 'rgba(221, 107, 32, 0.55)',
  spellAimOut: 'rgba(197, 48, 48, 0.5)',
  kindlingPatch: 'rgba(236, 201, 75, 0.65)',
  wallFlame: 'rgba(221, 107, 32, 0.45)',
  faultPatch: 'rgba(160, 174, 192, 0.7)',
  boulder: 'rgba(113, 128, 150, 0.9)',
  tornadoLane: 'rgba(144, 205, 244, 0.5)',
  blizzardZone: 'rgba(186, 230, 253, 0.35)',
  wetSheet: 'rgba(66, 153, 225, 0.4)',
  wetPuddle: 'rgba(49, 130, 206, 0.55)',
  geyserColumn: 'rgba(99, 179, 237, 0.45)',
  mana: '#63b3ed',
  wizard: '#f6e05e',
  enemy: '#fc8181',
  hpBar: '#48bb78',
  hpBarBg: '#2d3748',
  text: '#e2e8f0',
  pathDebug: '#63b3ed',
  infraStair: '#a0aec0',
  infraElevator: '#ecc94b',
  infraPipe: '#4299e1',
  /** Pipe not yet connected to a water (or steam) seed. */
  infraPipeDry: '#718096',
  infraPipeSteam: '#ed8936',
  soldier: '#68d391',
  mage: '#b794f4',
  laborer: '#f6ad55',
  connectivityWarn: '#ff5c5c',
} as const;

/** Workers-layer glyph per staff kind. */
export const STAFF_GLYPHS = {
  soldier: '↑',
  mage: '*',
  laborer: '·',
} as const;
