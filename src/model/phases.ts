import { clearElevators, initElevators } from './elevators';
import { prepareWaveNames } from './game';
import { addMessage } from './messages';
import { lockPipeFluids } from './pipes';
import { resetRoomBehaviors } from './rooms';
import { restoreTurretMana } from './rooms/turret';
import { clearStaffAfterWave, deployStaffForWave } from './staff';
import { assignSurplusLaborers, maxWaterReachRow } from './staff/harvest';
import { rewardGold } from '../calculations/economy';
import {
  cloneResources,
  emptyResources,
  formatWaveHaul,
  totalResourceUnits,
} from '../calculations/resources';
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
import { towerExtents } from './tower';
import { snapWizardToPerch } from './wizard';
import type { WaveDef } from './progression';
import type { GameState } from './types';

export function captureBuildBaseline(state: GameState): void {
  state.buildBaseline = {
    tower: structuredClone(state.tower),
    resources: cloneResources(state.player.resources),
    housingRecruited: structuredClone(state.housingRecruited),
    slotAllocations: structuredClone(state.slotAllocations),
    manaSpringAllocations: structuredClone(state.manaSpringAllocations),
    researchRoomAllocations: structuredClone(state.researchRoomAllocations),
    prospectAllocation: state.prospectAllocation,
  };
  state.buildRecruitSpend = 0;
}

export function startRun(state: GameState): void {
  state.scene = 'run';
  state.phase = 'build';
  captureBuildBaseline(state);
  addMessage(
    state,
    `A starter tower frame is in place — climb toward height ${WIN_HEIGHT}.`,
    'info',
  );
}

export function framingHeight(state: GameState): number {
  return towerExtents(state.tower).maxOccupiedRow;
}

export function beginWave(state: GameState, override?: WaveDef): void {
  const height = framingHeight(state);
  state.waveStartHeight = height;
  state.unlockedEnemyIds = unlockEnemiesForHeight(state.unlockedEnemyIds, height);

  const wave =
    override ??
    heightProgression.getWave({
      height,
      unlockedEnemyIds: new Set(state.unlockedEnemyIds),
    });
  state.phase = 'attack';
  state.enemies = [];
  state.spawnQueue = buildSpawnQueue(wave);
  prepareWaveNames(state);
  state.spawnTimer = 0;
  state.waveTimer = 0;
  state.roomEffectTimers = {};
  state.waveHaul = emptyResources();
  state.pendingWaveClear = null;
  resetRoomBehaviors(state);
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
  const customNote = override ? ' (custom)' : '';
  addMessage(
    state,
    `Wave ${state.levelIndex + 1} at height ${height}: ${state.spawnQueue.length} foes${customNote}.`,
    'combat',
  );
}

export function endWave(state: GameState): void {
  const rewardHeight = state.waveStartHeight;
  const amount = heightProgression.rewardFor(rewardHeight);
  rewardGold(state, amount);
  addMessage(state, `Wave ${state.levelIndex + 1} cleared! +${amount} gold.`, 'economy');

  const haul = cloneResources(state.waveHaul);
  const prospectNote = state.prospectResolved
    ? `Depth ${state.mine.unlockedDepth} discovered.`
    : null;
  state.pendingWaveClear = { gold: amount, haul, prospectNote };
  const haulLabel = formatWaveHaul(haul);
  addMessage(
    state,
    totalResourceUnits(haul) > 0 ? `Mine haul: ${haulLabel}.` : 'Mine haul: nothing this wave.',
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
    return;
  }

  state.levelIndex += 1;
  state.waveIndex += 1;
  state.phase = 'build';
  restoreTurretMana(state);
  clearStaffAfterWave(state);
  clearElevators(state);
  state.boilerRuntime = {};
  state.steamTurretRuntime = {};
  state.flameTurretRuntime = {};
  captureBuildBaseline(state);
  addMessage(state, `Height ${endHeight} / ${WIN_HEIGHT} — climb when ready.`, 'info');
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
