import {
  CARRIER_HOVER_MACRO_RANGE,
  CARRIER_KAMIKAZE_LIFETIME_MACRO,
  CARRIER_LAUNCH_INTERVAL,
  MAX_LIVE_ENEMIES,
  MAX_MANA,
  STARTING_CURRENCY,
  WIZARD_DEFAULTS,
} from '@/config/constants';
import { sameMacroCell, macroCellOfNode } from '@/calculations/subGrid';
import { resetStaffCounter, stepStaff, tickLaborerRepairs } from './staff';
import { stepElevators } from './elevators';
import { tickBoilers } from './boilers';
import { tickManaSprings } from './manaSprings';
import { tickSteamTurrets } from './steamTurrets';
import { STARTING_BLUEPRINT_IDS } from './blueprints';
import {
  faceOf,
  flySpawnBandForLevel,
  isWalkable,
  spawnAirNode,
  spawnNode,
} from '../calculations/exteriorGraph';
import { getEnemyTemplate } from './enemies';
import {
  attackBlockingRoom,
  attackWizard,
  closestRoomToEnemy,
  enemyTouchesRoom,
  greedyStepTowardRoom,
} from './enemies/flierCombat';
import { addMessage } from './messages';
import { findPath } from '../calculations/pathfinding';
import { runEnemyStepEffects, runRoomEffects } from './modifications/effects';
import {
  buildSpellContext,
  blizzardSlowMultiplier,
  getEffectiveWizardPosition,
  isMacroCellBlockedByTornado,
  mitigateWizardDamage,
  onEnemyWallStep,
  runAutoSpells,
  runFaultPatchStepEffects,
  runKindlingPatchStepEffects,
  shouldStubDiscombobulatedStep,
  tickAirEffects,
  tickEarthEffects,
  tickFireEffects,
  tickSpellCooldowns,
} from './spells';
import { endWave, loseGame, startRun, captureBuildBaseline } from './phases';
import { seedFrom, shuffle } from '../calculations/rng';
import { createStarterTower } from './starterTower';
import { goblinNames, bruteNames, wispNames } from '@/static/names';
import { spawnIntervalFor } from './waves';
import type { Enemy, EnemyTemplate, ExteriorNode, GameState, SimSpeed } from './types';

let enemyCounter = 0;
let waveNamePools: Record<string, string[]> = {};

const DEFAULT_SIM_SPEED: SimSpeed = 1;

export function createInitialState(seed: string | number = 'wizard'): GameState {
  enemyCounter = 0;
  waveNamePools = {};
  const state: GameState = {
    scene: 'run',
    phase: 'build',
    progressionMode: 'linear',
    levelIndex: 0,
    waveIndex: 0,
    waveTimer: 0,
    spawnTimer: 0,
    spawnQueue: [],
    simSpeed: loadSimSpeed(),
    player: {
      currency: STARTING_CURRENCY,
      unlockedBlueprints: [...STARTING_BLUEPRINT_IDS],
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
    activeSpellSchool: 'fire',
    boilerRuntime: {},
    steamTurretRuntime: {},
    elevators: [],
    buildBaseline: null,
  };
  resetStaffCounter();
  captureBuildBaseline(state);
  return state;
}

function loadSimSpeed(): SimSpeed {
  if (typeof localStorage === 'undefined') return DEFAULT_SIM_SPEED;
  const raw = localStorage.getItem('wizard-tower-sim-speed');
  if (raw === '2') return 2;
  if (raw === '4') return 4;
  return 1;
}

export function persistSimSpeed(speed: SimSpeed): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('wizard-tower-sim-speed', String(speed));
  }
}

export function beginRun(state: GameState): void {
  startRun(state);
}

const namePools: Record<string, readonly string[]> = {
  swarm: goblinNames,
  skirmisher: wispNames,
  elite: bruteNames,
  brute: bruteNames,
  striker: wispNames,
  kamikaze: wispNames,
  carrier: bruteNames,
  carrierKamikaze: wispNames,
  // Legacy ids for tests / saves
  goblin: goblinNames,
  wisp: wispNames,
};

/** Build shuffled, without-replacement name queues for each enemy type in the wave. */
export function prepareWaveNames(state: GameState): void {
  waveNamePools = {};
  const counts = new Map<string, number>();
  for (const templateId of state.spawnQueue) {
    counts.set(templateId, (counts.get(templateId) ?? 0) + 1);
  }

  let rngState = state.rngState;
  for (const [templateId, count] of counts) {
    const source = namePools[templateId] ?? ['Foe'];
    const assigned: string[] = [];
    while (assigned.length < count) {
      const shuffled = shuffle(rngState, source);
      rngState = shuffled.state;
      for (const name of shuffled.items) {
        if (assigned.length >= count) break;
        assigned.push(name);
      }
    }
    waveNamePools[templateId] = assigned;
  }
  state.rngState = rngState;
}

function pickName(templateId: string): string {
  const queue = waveNamePools[templateId];
  if (queue && queue.length > 0) {
    return queue.shift()!;
  }
  const pool = namePools[templateId] ?? ['Foe'];
  return pool[0];
}

/** Test and debug helper for dequeuing a wave name without spawning. */
export function takeEnemyName(templateId: string): string {
  return pickName(templateId);
}

function spawnEnemy(state: GameState, template: EnemyTemplate, side: 'left' | 'right'): void {
  const wizardPos = getEffectiveWizardPosition(state);
  const pos = template.movement.canFly
    ? spawnAirNode(state.tower, side, flySpawnBandForLevel(state.levelIndex), wizardPos)
    : spawnNode(state.tower, side);
  const enemy: Enemy = {
    id: `enemy-${enemyCounter++}`,
    templateId: template.id,
    name: pickName(template.id),
    pos,
    path: [],
    pathIndex: 0,
    currentHp: template.stats.maxHp,
    moveCooldown: 0,
    attackCooldown: 0,
    lastMacroKey: `${macroCellOfNode(pos).col},${macroCellOfNode(pos).row}`,
    macroCellsMoved: 0,
  };
  state.enemies.push(enemy);
}

function spawnCarrierDrone(state: GameState, carrier: Enemy): void {
  const template = getEnemyTemplate('carrierKamikaze');
  if (!template) return;
  const enemy: Enemy = {
    id: `enemy-${enemyCounter++}`,
    templateId: template.id,
    name: pickName(template.id),
    pos: { ...carrier.pos, face: faceOf(state.tower, carrier.pos.col, carrier.pos.row) },
    path: [],
    pathIndex: 0,
    currentHp: template.stats.maxHp,
    moveCooldown: 0,
    attackCooldown: 0,
    lifetimeMacroCells: CARRIER_KAMIKAZE_LIFETIME_MACRO,
    macroCellsMoved: 0,
    lastMacroKey: `${macroCellOfNode(carrier.pos).col},${macroCellOfNode(carrier.pos).row}`,
  };
  state.enemies.push(enemy);
}

function reached(a: ExteriorNode, b: ExteriorNode): boolean {
  return sameMacroCell(a, b);
}

function macroManhattan(a: ExteriorNode, b: ExteriorNode): number {
  const am = macroCellOfNode(a);
  const bm = macroCellOfNode(b);
  return Math.abs(am.col - bm.col) + Math.abs(am.row - bm.row);
}

function trackMacroMovement(enemy: Enemy): void {
  const m = macroCellOfNode(enemy.pos);
  const key = `${m.col},${m.row}`;
  if (enemy.lastMacroKey && enemy.lastMacroKey !== key) {
    enemy.macroCellsMoved = (enemy.macroCellsMoved ?? 0) + 1;
  }
  enemy.lastMacroKey = key;
  if (
    enemy.lifetimeMacroCells !== undefined
    && (enemy.macroCellsMoved ?? 0) >= enemy.lifetimeMacroCells
  ) {
    enemy.currentHp = 0;
  }
}

function wizardGoalKey(pos: ExteriorNode): string {
  const m = macroCellOfNode(pos);
  return `${m.col},${m.row}`;
}

/** Advance one fixed timestep. Only meaningful during the attack phase. */
export function step(state: GameState, dt: number): void {
  if (state.scene !== 'run' || state.phase !== 'attack') {
    return;
  }
  state.waveTimer += dt;

  const wizardPos = getEffectiveWizardPosition(state);
  const wizard = state.player.wizard;

  // Spawn from the queue, alternating sides (paused when at live cap).
  state.spawnTimer -= dt;
  if (
    state.spawnTimer <= 0 &&
    state.spawnQueue.length > 0 &&
    state.enemies.length < MAX_LIVE_ENEMIES
  ) {
    const templateId = state.spawnQueue.shift()!;
    const template = getEnemyTemplate(templateId);
    if (template) {
      const side = state.enemies.length % 2 === 0 ? 'left' : 'right';
      spawnEnemy(state, template, side);
    }
    state.spawnTimer = spawnIntervalFor(templateId);
  }

  const goalKey = wizardGoalKey(wizardPos);
  const launches: Enemy[] = [];

  for (const enemy of state.enemies) {
    if (enemy.currentHp <= 0) continue;
    const template = getEnemyTemplate(enemy.templateId);
    if (!template) continue;

    if (enemy.airborne) continue;

    // Fliers always repath when the wizard moves; crawlers keep prior stale-path refresh.
    const needsRepath =
      enemy.path.length === 0
      || (template.movement.canFly && enemy.pathGoalKey !== goalKey)
      || (
        enemy.path.length > 0
        && enemy.pathIndex >= enemy.path.length - 1
        && !reached(enemy.pos, wizardPos)
      );

    if (needsRepath) {
      enemy.path = findPath(state.tower, enemy.pos, wizardPos, template.movement);
      enemy.pathIndex = 0;
      enemy.pathGoalKey = goalKey;
    }

    // Carriers hover in a band and launch drones instead of closing to melee.
    if (template.carrier) {
      const dist = macroManhattan(enemy.pos, wizardPos);
      enemy.carrierLaunchTimer = (enemy.carrierLaunchTimer ?? 0) - dt;
      if (enemy.carrierLaunchTimer <= 0) {
        launches.push(enemy);
        enemy.carrierLaunchTimer = CARRIER_LAUNCH_INTERVAL;
      }
      if (dist <= CARRIER_HOVER_MACRO_RANGE) {
        continue;
      }
    }

    if (reached(enemy.pos, wizardPos)) {
      attackWizard(state, enemy, template, wizard, mitigateWizardDamage, dt);
      continue;
    }

    // No air path: press the closest room and attack when adjacent.
    if (template.movement.canFly && enemy.path.length === 0) {
      const room = closestRoomToEnemy(state, enemy);
      if (room && enemyTouchesRoom(enemy, room)) {
        attackBlockingRoom(state, enemy, template, dt);
        continue;
      }
      enemy.moveCooldown -= dt;
      if (enemy.moveCooldown <= 0 && room) {
        const stepTo = greedyStepTowardRoom(enemy, room, (col, row) =>
          isWalkable(state.tower, col, row, template.movement));
        if (stepTo) {
          enemy.pos = stepTo;
          trackMacroMovement(enemy);
        }
        enemy.moveCooldown = (1 / template.speed) * blizzardSlowMultiplier(state, enemy);
      }
      continue;
    }

    enemy.moveCooldown -= dt;
    if (enemy.moveCooldown <= 0 && enemy.pathIndex < enemy.path.length - 1) {
      const nextPos = enemy.path[enemy.pathIndex + 1];
      const nextMacro = macroCellOfNode(nextPos);
      if (isMacroCellBlockedByTornado(state, nextMacro.col, nextMacro.row)) {
        enemy.moveCooldown = 0.2;
        continue;
      }
      if (shouldStubDiscombobulatedStep(state.tower, enemy, nextPos)) {
        enemy.moveCooldown = (1 / template.speed) * blizzardSlowMultiplier(state, enemy);
        continue;
      }
      enemy.pathIndex += 1;
      enemy.pos = nextPos;
      trackMacroMovement(enemy);
      enemy.moveCooldown = (1 / template.speed) * blizzardSlowMultiplier(state, enemy);
      if (!template.movement.canFly) {
        runEnemyStepEffects(state, enemy);
        onEnemyWallStep(state, enemy);
      }
      runKindlingPatchStepEffects(state, enemy);
      runFaultPatchStepEffects(state, enemy);
    }
  }

  for (const carrier of launches) {
    if (carrier.currentHp > 0 && state.enemies.length < MAX_LIVE_ENEMIES) {
      spawnCarrierDrone(state, carrier);
    }
  }

  tickSpellCooldowns(state, dt);
  runAutoSpells(state);
  tickFireEffects(state, dt, (spellName) => buildSpellContext(state, spellName));
  tickAirEffects(state, dt, (spellName) => buildSpellContext(state, spellName));
  tickEarthEffects(state, dt, (spellName) => buildSpellContext(state, spellName));

  // Elevator cars, then staff movement and laborer repairs during attack.
  stepElevators(state, dt);
  stepStaff(state, dt);
  tickLaborerRepairs(state, dt);

  // Room behaviors (turret rooms, slot volleys) and modifications (spikes) act on enemies this tick.
  runRoomEffects(state, dt);

  // Mana springs → boilers → steam turrets (PIPES.md attack order).
  tickManaSprings(state, dt);
  tickBoilers(state, dt);
  tickSteamTurrets(state, dt);

  // Reap dead enemies and award currency.
  const survivors: Enemy[] = [];
  for (const enemy of state.enemies) {
    if (enemy.currentHp <= 0) {
      const template = getEnemyTemplate(enemy.templateId);
      if (template) {
        state.player.currency += template.currencyReward;
        addMessage(state, `${enemy.name} the ${template.type} destroyed. +${template.currencyReward} gold.`, 'economy');
      }
    } else {
      survivors.push(enemy);
    }
  }
  state.enemies = survivors;

  if (wizard.hp <= 0) {
    loseGame(state);
    return;
  }

  if (state.spawnQueue.length === 0 && state.enemies.length === 0) {
    endWave(state);
  }
}
