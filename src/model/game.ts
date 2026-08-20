import {
  MAX_MANA,
  SOLAR_COLLECTOR_DEFAULTS,
  STARTING_RESOURCES,
  WIZARD_DEFAULTS,
} from '@/config/constants';
import { DAY_DURATION } from '@/config/dayNight';
import { cloneResources, emptyResources } from '@/calculations/resources';
import {
  STARTING_BLUEPRINT_IDS,
  STARTING_INFRA_BLUEPRINT_IDS,
  STARTING_MODIFICATION_IDS,
} from './blueprints';
import { emptyResearchState } from './research';
import { startRun } from './phases';
import { createStarterTower, initStarterFacilities } from './starterTower';
import { resetTickState } from './tick';
import { resetConstructionCounter } from './construction';
import { resetSideJobCounter } from './sideJobs';
import { seedFrom } from '../calculations/rng';
import { generateShallowMine } from './mines';
import { createWizardAvatarAtPerch } from './wizard';
import type { GameState, SimSpeed } from './types';

const DEFAULT_SIM_SPEED: SimSpeed = 1;

export function createInitialState(seed: string | number = 'wizard'): GameState {
  resetTickState();
  resetConstructionCounter();
  resetSideJobCounter();
  const state: GameState = {
    scene: 'run',
    phase: 'day',
    sessionSeed: seed,
    progressionMode: 'height',
    levelIndex: 0,
    waveIndex: 0,
    waveTimer: 0,
    spawnTimer: 0,
    spawnQueue: [],
    waveStartHeight: 0,
    unlockedEnemyIds: [],
    simSpeed: DEFAULT_SIM_SPEED,
    player: {
      resources: cloneResources({ ...STARTING_RESOURCES }),
      unlockedBlueprints: [...STARTING_BLUEPRINT_IDS, ...STARTING_INFRA_BLUEPRINT_IDS],
      unlockedModifications: [...STARTING_MODIFICATION_IDS],
      research: emptyResearchState(),
      levelIndex: 0,
      wizard: { ...WIZARD_DEFAULTS, glyph: '@' },
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
    prospectAllocation: 0,
    dayIndex: 1,
    phaseTimer: DAY_DURATION,
    phasePaused: false,
    storageSites: {},
    storageReservations: [],
    constructionOrders: [],
    sideJobs: [],
    pendingRecruitSpend: 0,
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
    turretRuntime: {},
    elevators: [],
    mine: { entrance: { col: 0, row: -1 }, tunnels: {}, patches: [], unlockedDepth: 1 },
    waveHaul: emptyResources(),
    pendingWaveClear: null,
    solarCollector: {
      hp: SOLAR_COLLECTOR_DEFAULTS.maxHp,
      maxHp: SOLAR_COLLECTOR_DEFAULTS.maxHp,
      glyph: SOLAR_COLLECTOR_DEFAULTS.glyph,
    },
    wizardAvatar: {
      pos: { col: 0, row: 0, face: 'top' },
      path: [],
      pathIndex: 0,
      macroPath: [],
      macroPathIndex: 0,
      moveCooldown: 0,
      status: 'idle',
    },
    prospectWorkElapsed: 0,
    prospectResolved: false,
  };
  state.mine = generateShallowMine(state.tower);
  state.wizardAvatar = createWizardAvatarAtPerch(state);
  initStarterFacilities(state);
  startRun(state);
  return state;
}

export function beginRun(state: GameState): void {
  startRun(state);
}
export { prepareWaveNames, step, takeEnemyName } from './tick';
