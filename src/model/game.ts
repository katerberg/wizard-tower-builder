import {
  MAX_MANA,
  STARTING_RESOURCES,
  WIZARD_DEFAULTS,
} from '@/config/constants';
import { cloneResources, emptyResources } from '@/calculations/resources';
import {
  STARTING_BLUEPRINT_IDS,
  STARTING_INFRA_BLUEPRINT_IDS,
  STARTING_MODIFICATION_IDS,
} from './blueprints';
import { emptyResearchState } from './research';
import { startRun, captureBuildBaseline } from './phases';
import { seedFrom } from '../calculations/rng';
import { generateShallowMine } from './mines';
import { createStarterTower } from './starterTower';
import { resetTickState } from './tick';
import type { GameState, SimSpeed } from './types';

const DEFAULT_SIM_SPEED: SimSpeed = 1;

export function createInitialState(seed: string | number = 'wizard'): GameState {
  resetTickState();
  const state: GameState = {
    scene: 'run',
    phase: 'build',
    progressionMode: 'height',
    levelIndex: 0,
    waveIndex: 0,
    waveTimer: 0,
    spawnTimer: 0,
    spawnQueue: [],
    waveStartHeight: 0,
    unlockedEnemyIds: [],
    simSpeed: loadSimSpeed(),
    player: {
      resources: cloneResources({ ...STARTING_RESOURCES }),
      unlockedBlueprints: [...STARTING_BLUEPRINT_IDS, ...STARTING_INFRA_BLUEPRINT_IDS],
      unlockedModifications: [...STARTING_MODIFICATION_IDS],
      research: emptyResearchState(),
      levelIndex: 0,
      wizard: { ...WIZARD_DEFAULTS, hp: WIZARD_DEFAULTS.maxHp, glyph: '@' },
      mana: MAX_MANA,
      maxMana: MAX_MANA,
    },
    tower: createStarterTower(),
    enemies: [],
    messages: [],
    rngState: seedFrom(seed),
    devMode: false,
    roomEffectTimers: {},
    staff: [],
    housingRecruited: {},
    slotAllocations: {},
    manaSpringAllocations: {},
    researchRoomAllocations: {},
    buildRecruitSpend: 0,
    spellCooldowns: {},
    kindlingPatches: [],
    wallOfFlameSegments: [],
    fireEnterDone: {},
    tornadoSegments: [],
    blizzardZones: [],
    tornadoEnterDone: {},
    earthCharge: 0,
    faultPatches: [],
    fortified: false,
    fortifyChargeAccum: 0,
    pendingBoulders: [],
    wetCells: [],
    activeWaterfalls: [],
    hydrantSprayTimers: {},
    activeSpellSchool: 'fire',
    boilerRuntime: {},
    steamTurretRuntime: {},
    flameTurretRuntime: {},
    elevators: [],
    mine: { entrance: { col: 0, row: -1 }, tunnels: {}, patches: [] },
    waveHaul: emptyResources(),
    pendingWaveClear: null,
    buildBaseline: null,
  };
  state.mine = generateShallowMine(state.tower);
  captureBuildBaseline(state);
  return state;
}

function loadSimSpeed(): SimSpeed {
  if (typeof localStorage === 'undefined') return DEFAULT_SIM_SPEED;
  const raw = localStorage.getItem('wizard-tower-sim-speed');
  const parsed = Number(raw);
  if (parsed === 2 || parsed === 5 || parsed === 10) return parsed;
  // Migrate legacy 4× preference to the nearest current rung.
  if (parsed === 4) return 5;
  return DEFAULT_SIM_SPEED;
}

export function persistSimSpeed(speed: SimSpeed): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('wizard-tower-sim-speed', String(speed));
  }
}

export function beginRun(state: GameState): void {
  startRun(state);
}
export { prepareWaveNames, step, takeEnemyName } from './tick';
