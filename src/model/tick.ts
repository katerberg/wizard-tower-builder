import {
  CARRIER_HOVER_MACRO_RANGE,
  CARRIER_KAMIKAZE_LIFETIME_MACRO,
  CARRIER_LAUNCH_INTERVAL,
  MAX_LIVE_ENEMIES,
} from '@/config/constants';
import { rewardSouls } from '@/calculations/economy';
import { sameMacroCell, macroCellOfNode } from '@/calculations/subGrid';
import { resetStaffCounter, stepStaff, tickLaborerRepairs } from './staff';
import { tickLaborerHarvestAndPump } from './staff/harvest';
import { applyExteriorAbrasion, tickStoneWeathering } from './wear';
import { stepElevators } from './elevators';
import { tickRoomBehaviors } from './rooms';
import { faceOf, flySpawnBandForCrown, isWalkable, spawnAirNode, spawnNode } from '../calculations/exteriorGraph';
import { getEnemyTemplate, PLANNING_UNDER_OVERHANG } from './enemies';
import { attackOverhangBlocking } from './enemies/demolisherCombat';
import { attackBlockingRoom, attackWizard, closestRoomToEnemy, enemyTouchesRoom, greedyStepTowardRoom } from './enemies/flierCombat';
import { addMessage } from './messages';
import { findPath } from '../calculations/pathfinding';
import { stakesSlowMultiplier } from './fortifications/effects';
import { runEnemyStepEffects, runRoomEffects } from './modifications/effects';
import {
  buildSpellContext, blizzardSlowMultiplier, getEffectiveWizardPosition,
  isMacroCellBlockedByTornado, mitigateWizardDamage, onEnemyWallStep, runAutoSpells,
  runFaultPatchStepEffects, runKindlingPatchStepEffects, runWetCellStepEffects,
  shouldStubDiscombobulatedStep, soakSlowMultiplier, tickAirEffects, tickEarthEffects,
  tickFireEffects, tickSpellCooldowns, tickWaterEffects,
} from './spells';
import { endWave, loseGame } from './phases';
import { shuffle } from '../calculations/rng';
import { goblinNames, bruteNames, wispNames } from './names';
import { spawnIntervalFor } from './waves';
import type { Enemy, EnemyTemplate, ExteriorNode, GameState, MovementProfile } from './types';

let enemyCounter = 0;
let waveNamePools: Record<string, string[]> = {};

export function resetTickState(): void {
  enemyCounter = 0;
  waveNamePools = {};
  resetStaffCounter();
}

const namePools: Record<string, readonly string[]> = {
  swarm: goblinNames, skirmisher: wispNames, elite: bruteNames, brute: bruteNames,
  demolisher: bruteNames, demolisherElite: bruteNames, demolisherBrute: bruteNames,
  striker: wispNames, kamikaze: wispNames, carrier: bruteNames, carrierKamikaze: wispNames,
  goblin: goblinNames, wisp: wispNames,
};

function pathProfileFor(movement: MovementProfile): MovementProfile {
  return movement.canAttackOverhang ? PLANNING_UNDER_OVERHANG : movement;
}

export function prepareWaveNames(state: GameState): void {
  waveNamePools = {};
  const counts = new Map<string, number>();
  for (const templateId of state.spawnQueue) counts.set(templateId, (counts.get(templateId) ?? 0) + 1);
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
  if (queue && queue.length > 0) return queue.shift()!;
  return (namePools[templateId] ?? ['Foe'])[0];
}

export function takeEnemyName(templateId: string): string {
  return pickName(templateId);
}

function spawnEnemy(state: GameState, template: EnemyTemplate, side: 'left' | 'right'): void {
  const wizardPos = getEffectiveWizardPosition(state);
  const pos = template.movement.canFly
    ? spawnAirNode(state.tower, side, flySpawnBandForCrown(state.waveStartHeight), wizardPos)
    : spawnNode(state.tower, side);
  state.enemies.push({
    id: `enemy-${enemyCounter++}`, templateId: template.id, name: pickName(template.id), pos,
    path: [], pathIndex: 0, currentHp: template.stats.maxHp, moveCooldown: 0, attackCooldown: 0,
    lastMacroKey: `${macroCellOfNode(pos).col},${macroCellOfNode(pos).row}`, macroCellsMoved: 0,
  });
}

function spawnCarrierDrone(state: GameState, carrier: Enemy): void {
  const template = getEnemyTemplate('carrierKamikaze');
  if (!template) return;
  state.enemies.push({
    id: `enemy-${enemyCounter++}`, templateId: template.id, name: pickName(template.id),
    pos: { ...carrier.pos, face: faceOf(state.tower, carrier.pos.col, carrier.pos.row) },
    path: [], pathIndex: 0, currentHp: template.stats.maxHp, moveCooldown: 0, attackCooldown: 0,
    lifetimeMacroCells: CARRIER_KAMIKAZE_LIFETIME_MACRO, macroCellsMoved: 0,
    lastMacroKey: `${macroCellOfNode(carrier.pos).col},${macroCellOfNode(carrier.pos).row}`,
  });
}

function reached(a: ExteriorNode, b: ExteriorNode): boolean { return sameMacroCell(a, b); }
function macroManhattan(a: ExteriorNode, b: ExteriorNode): number {
  const am = macroCellOfNode(a); const bm = macroCellOfNode(b);
  return Math.abs(am.col - bm.col) + Math.abs(am.row - bm.row);
}
function moveSlowMultiplier(state: GameState, enemy: Enemy): number {
  const template = getEnemyTemplate(enemy.templateId);
  const stakes = stakesSlowMultiplier(state.tower, enemy.pos, template?.movement.canFly === true);
  return blizzardSlowMultiplier(state, enemy) * soakSlowMultiplier(state, enemy) * stakes;
}
function trackMacroMovement(enemy: Enemy, state: GameState, canFly: boolean): void {
  const m = macroCellOfNode(enemy.pos); const key = `${m.col},${m.row}`;
  if (enemy.lastMacroKey && enemy.lastMacroKey !== key) {
    enemy.macroCellsMoved = (enemy.macroCellsMoved ?? 0) + 1;
    if (!canFly && enemy.pos.face !== 'air') applyExteriorAbrasion(state, { col: m.col, row: m.row });
  }
  enemy.lastMacroKey = key;
  if (enemy.lifetimeMacroCells !== undefined && (enemy.macroCellsMoved ?? 0) >= enemy.lifetimeMacroCells) enemy.currentHp = 0;
}
function wizardGoalKey(pos: ExteriorNode): string {
  const m = macroCellOfNode(pos); return `${m.col},${m.row}`;
}

/** Advance one fixed timestep. Only meaningful during the attack phase. */
export function step(state: GameState, dt: number): void {
  if (state.scene !== 'run' || state.phase !== 'attack') return;
  state.waveTimer += dt;
  const wizardPos = getEffectiveWizardPosition(state);
  const wizard = state.player.wizard;

  // 1. Spawn queued enemies, alternating sides while below the live cap.
  state.spawnTimer -= dt;
  if (state.spawnTimer <= 0 && state.spawnQueue.length > 0 && state.enemies.length < MAX_LIVE_ENEMIES) {
    const templateId = state.spawnQueue.shift()!;
    const template = getEnemyTemplate(templateId);
    if (template) spawnEnemy(state, template, state.enemies.length % 2 === 0 ? 'left' : 'right');
    state.spawnTimer = spawnIntervalFor(templateId);
  }

  // 2. Enemy movement and combat.
  const goalKey = wizardGoalKey(wizardPos);
  const launches: Enemy[] = [];
  for (const enemy of state.enemies) {
    if (enemy.currentHp <= 0) continue;
    const template = getEnemyTemplate(enemy.templateId);
    if (!template || enemy.airborne) continue;
    const needsRepath = enemy.path.length === 0 || (template.movement.canFly && enemy.pathGoalKey !== goalKey) ||
      (enemy.path.length > 0 && enemy.pathIndex >= enemy.path.length - 1 && !reached(enemy.pos, wizardPos));
    if (needsRepath) {
      enemy.path = findPath(state.tower, enemy.pos, wizardPos, pathProfileFor(template.movement));
      enemy.pathIndex = 0;
      enemy.pathGoalKey = goalKey;
    }
    if (template.carrier) {
      const dist = macroManhattan(enemy.pos, wizardPos);
      enemy.carrierLaunchTimer = (enemy.carrierLaunchTimer ?? 0) - dt;
      if (enemy.carrierLaunchTimer <= 0) { launches.push(enemy); enemy.carrierLaunchTimer = CARRIER_LAUNCH_INTERVAL; }
      if (dist <= CARRIER_HOVER_MACRO_RANGE) continue;
    }
    if (reached(enemy.pos, wizardPos)) { attackWizard(state, enemy, template, wizard, mitigateWizardDamage, dt); continue; }
    if (template.movement.canFly && enemy.path.length === 0) {
      const room = closestRoomToEnemy(state, enemy);
      if (room && enemyTouchesRoom(enemy, room)) { attackBlockingRoom(state, enemy, template, dt); continue; }
      enemy.moveCooldown -= dt;
      if (enemy.moveCooldown <= 0 && room) {
        const stepTo = greedyStepTowardRoom(enemy, room, (col, row) => isWalkable(state.tower, col, row, template.movement));
        if (stepTo) { enemy.pos = stepTo; trackMacroMovement(enemy, state, true); }
        enemy.moveCooldown = (1 / template.speed) * moveSlowMultiplier(state, enemy);
      }
      continue;
    }
    // Demolisher with no preferred path and nothing to smash: idle.
    if (template.movement.canAttackOverhang && enemy.path.length === 0) continue;
    enemy.moveCooldown -= dt;
    if (enemy.moveCooldown <= 0 && enemy.pathIndex < enemy.path.length - 1) {
      const nextPos = enemy.path[enemy.pathIndex + 1]; const nextMacro = macroCellOfNode(nextPos);
      if (isMacroCellBlockedByTornado(state, nextMacro.col, nextMacro.row)) { enemy.moveCooldown = 0.2; continue; }
      if (shouldStubDiscombobulatedStep(state.tower, enemy, nextPos)) { enemy.moveCooldown = (1 / template.speed) * moveSlowMultiplier(state, enemy); continue; }
      if (!isWalkable(state.tower, nextPos.col, nextPos.row, template.movement)) {
        if (template.movement.canAttackOverhang) {
          attackOverhangBlocking(state, enemy, template, nextPos, dt);
        }
        // Blocked — stay put; attackCooldown gates swings. Retry next tick.
        enemy.moveCooldown = 0;
        continue;
      }
      enemy.pathIndex += 1; enemy.pos = nextPos; trackMacroMovement(enemy, state, template.movement.canFly);
      enemy.moveCooldown = (1 / template.speed) * moveSlowMultiplier(state, enemy);
      if (!template.movement.canFly) { runEnemyStepEffects(state, enemy); onEnemyWallStep(state, enemy); }
      runKindlingPatchStepEffects(state, enemy); runFaultPatchStepEffects(state, enemy); runWetCellStepEffects(state, enemy);
    }
  }
  for (const carrier of launches) if (carrier.currentHp > 0 && state.enemies.length < MAX_LIVE_ENEMIES) spawnCarrierDrone(state, carrier);

  // 3. Spell cooldowns, auto-casting, and elemental effects.
  tickSpellCooldowns(state, dt); runAutoSpells(state);
  tickFireEffects(state, dt, (name) => buildSpellContext(state, name));
  tickAirEffects(state, dt, (name) => buildSpellContext(state, name));
  tickEarthEffects(state, dt, (name) => buildSpellContext(state, name)); tickWaterEffects(state, dt);

  // 4. Elevators, staff work, harvesting, and tower weathering.
  stepElevators(state, dt); stepStaff(state, dt); tickLaborerRepairs(state, dt);
  tickLaborerHarvestAndPump(state, dt); tickStoneWeathering(state, dt);

  // 5. Room and modification effects.
  runRoomEffects(state, dt); tickRoomBehaviors(state, dt);

  // 6. Award kills and resolve wave end states.
  const survivors: Enemy[] = [];
  for (const enemy of state.enemies) {
    if (enemy.currentHp <= 0) {
      const template = getEnemyTemplate(enemy.templateId);
      if (template) { rewardSouls(state, template.soulsReward); addMessage(state, `${enemy.name} the ${template.type} destroyed. +${template.soulsReward} souls.`, 'economy'); }
    } else survivors.push(enemy);
  }
  state.enemies = survivors;
  if (wizard.hp <= 0) { loseGame(state); return; }
  if (state.spawnQueue.length === 0 && state.enemies.length === 0) endWave(state);
}
