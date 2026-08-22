import { DAY_DURATION, NIGHT_DURATION } from '@/config/dayNight';
import { clearElevators, initElevators } from './elevators';
import { prepareWaveNames } from './game';
import { addMessage } from './messages';
import { lockPipeFluids } from './pipes';
import { resetRoomBehaviors } from './rooms';
import { restoreTurretMana } from './rooms/turret';
import { clearStaffAfterWave, deployStaffForWave } from './staff';
import { assignSurplusLaborers, maxWaterReachRow } from './staff/harvest';
import { resolveProspectAtNightfall } from './staff/prospect';
import { rewardGold } from '../calculations/economy';
import {
  cloneResources,
  emptyResources,
  formatWaveHaul,
  totalResourceUnits,
} from '../calculations/resources';
import { freezeIncompleteOrdersAtDusk } from './construction';
import { runWaveClearedEffects } from './modifications/effects';
import {
  refillMana,
  resetAirState,
  resetEarthState,
  resetFireState,
  resetSpellCooldowns,
  resetWaterState,
} from './spells';
import { heightProgression, unlockEnemiesForHeight, WIN_HEIGHT } from './waves';
import { buildSpawnQueue } from './waves';
import { completedTowerExtents } from './tower';
import { snapWizardToPerch } from './wizard';
import type { WaveDef } from './progression';
import type { GameState } from './types';

export function framingHeight(state: GameState): number {
  return completedTowerExtents(state.tower).maxOccupiedRow;
}

export function startRun(state: GameState): void {
  state.scene = 'run';
  state.phase = 'day';
  state.dayIndex = 1;
  state.phaseTimer = DAY_DURATION;
  state.phasePaused = false;
  addMessage(
    state,
    `Dawn breaks — climb toward height ${WIN_HEIGHT}. Laborers haul from the Storage Room.`,
    'info',
  );
}

export function tickPhaseTimer(state: GameState, dt: number): void {
  if (state.scene !== 'run' || state.phasePaused) return;
  state.phaseTimer -= dt;
  if (state.phaseTimer > 0) return;
  if (state.phase === 'day') {
    endDay(state);
  } else {
    checkNightEnd(state);
  }
}

export function endDay(state: GameState, override?: WaveDef): void {
  const height = framingHeight(state);
  state.waveStartHeight = height;
  state.unlockedEnemyIds = unlockEnemiesForHeight(state.unlockedEnemyIds, height);

  freezeIncompleteOrdersAtDusk(state);
  resolveProspectAtNightfall(state);

  const wave =
    override ??
    heightProgression.getWave({
      height,
      unlockedEnemyIds: new Set(state.unlockedEnemyIds),
    });
  beginNight(state, wave);
}

function beginNight(state: GameState, wave: WaveDef): void {
  state.phase = 'night';
  state.phaseTimer = NIGHT_DURATION;
  state.enemies = [];
  state.spawnQueue = buildSpawnQueue(wave);
  prepareWaveNames(state);
  state.spawnTimer = 0;
  state.waveTimer = 0;
  state.roomEffectTimers = {};
  state.waveHaul = emptyResources();
  state.pendingWaveClear = null;
  resetRoomBehaviors(state);

  // Charge pending recruit spend + upkeep at night deploy
  if (state.pendingRecruitSpend > 0) {
    state.player.resources.gold -= state.pendingRecruitSpend;
    state.pendingRecruitSpend = 0;
  }

  deployStaffForWave(state);
  assignSurplusLaborers(state);
  state.tower = lockPipeFluids(state.tower, maxWaterReachRow(state));
  initElevators(state);
  snapWizardToPerch(state);
  refillMana(state);
  resetSpellCooldowns(state);
  resetFireState(state);
  resetAirState(state);
  resetEarthState(state);
  resetWaterState(state);
  addMessage(
    state,
    `Night ${state.dayIndex}: wave at height ${state.waveStartHeight}, ${state.spawnQueue.length} foes.`,
    'combat',
  );
}

function checkNightEnd(state: GameState): void {
  if (state.enemies.length > 0) {
    state.enemies = [];
    addMessage(state, 'Survivors flee at dawn.', 'combat');
  }
  beginDay(state);
}

export function endWave(state: GameState): void {
  state.levelIndex += 1;
  state.waveIndex += 1;
  const rewardHeight = state.waveStartHeight;
  const amount = heightProgression.rewardFor(rewardHeight);
  rewardGold(state, amount);
  addMessage(state, `Wave cleared! +${amount} gold.`, 'economy');

  const haul = cloneResources(state.waveHaul);
  const prospectNote = state.prospectResolved
    ? `Depth ${state.mine.unlockedDepth} discovered.`
    : null;
  state.pendingWaveClear = { gold: amount, haul, prospectNote };
  const haulLabel = formatWaveHaul(haul);
  addMessage(
    state,
    totalResourceUnits(haul) > 0 ? `Mine haul: ${haulLabel}.` : 'Mine haul: nothing this night.',
    'economy',
  );
  if (prospectNote) {
    addMessage(state, `Prospecting: ${prospectNote}`, 'economy');
  }

  runWaveClearedEffects(state);
  resetEarthState(state);

  const endHeight = framingHeight(state);
  if (heightProgression.isVictoryHeight(endHeight)) {
    winGame(state);
  }
}

export function beginDay(state: GameState): void {
  if (state.scene !== 'run') return;
  state.phase = 'day';
  state.dayIndex += 1;
  state.phaseTimer = DAY_DURATION;
  state.prospectWorkElapsed = 0;
  state.prospectResolved = false;
  restoreTurretMana(state);
  clearStaffAfterWave(state);
  clearElevators(state);
  state.boilerRuntime = {};
  state.steamTurretRuntime = {};
  state.flameTurretRuntime = {};
  state.staff = [];
  const endHeight = framingHeight(state);
  addMessage(state, `Dawn day ${state.dayIndex} — height ${endHeight} / ${WIN_HEIGHT}.`, 'info');
}

export function loseGame(state: GameState): void {
  state.scene = 'gameOver';
  addMessage(state, 'The solar collector is destroyed. The tower is overrun.', 'combat');
}

export function winGame(state: GameState): void {
  state.scene = 'victory';
  addMessage(
    state,
    `The spire holds at height ${framingHeight(state)}! The tower stands triumphant!`,
    'info',
  );
}

/** @deprecated Use beginNight via endDay. Kept for dev custom waves. */
export function beginWave(state: GameState, override?: WaveDef): void {
  endDay(state, override);
}
