import { prepareWaveNames } from './game';
import { addMessage } from './messages';
import { resetBoilerRuntime } from './boilers';
import { lockPipeFluids } from './pipes';
import { resetSteamTurretRuntime } from './steamTurrets';
import { clearSoldiersAfterWave, deploySoldiersForWave } from './soldiers';
import { reward } from '../calculations/economy';
import { runWaveClearedEffects } from './modifications/effects';
import { refillMana, resetAirState, resetEarthState, resetFireState, resetSpellCooldowns } from './spells';
import { linearProgression } from './waves';
import { buildSpawnQueue } from './waves';
import type { GameState } from './types';

export function captureBuildBaseline(state: GameState): void {
  state.buildBaseline = {
    tower: structuredClone(state.tower),
    currency: state.player.currency,
  };
  state.buildRecruitSpend = 0;
}

export function startRun(state: GameState): void {
  state.scene = 'run';
  state.phase = 'build';
  captureBuildBaseline(state);
  addMessage(state, 'A starter tower frame is in place — reinforce it before wave 1.', 'info');
}

export function beginWave(state: GameState): void {
  const wave = linearProgression.getWave(state.levelIndex);
  state.phase = 'attack';
  state.enemies = [];
  state.spawnQueue = buildSpawnQueue(wave);
  prepareWaveNames(state);
  state.spawnTimer = 0;
  state.waveTimer = 0;
  state.roomEffectTimers = {};
  state.tower = lockPipeFluids(state.tower);
  resetBoilerRuntime(state);
  resetSteamTurretRuntime(state);
  deploySoldiersForWave(state);
  refillMana(state);
  resetSpellCooldowns(state);
  resetFireState(state);
  resetAirState(state);
  resetEarthState(state);
  addMessage(state, `Wave ${state.levelIndex + 1} incoming: ${state.spawnQueue.length} foes.`, 'combat');
}

export function endWave(state: GameState): void {
  const amount = linearProgression.rewardFor(state.levelIndex);
  reward(state, amount);
  addMessage(state, `Wave ${state.levelIndex + 1} cleared! +${amount} gold.`, 'economy');
  runWaveClearedEffects(state);
  resetEarthState(state);

  if (linearProgression.isFinalLevel(state.levelIndex)) {
    winGame(state);
    return;
  }

  state.levelIndex += 1;
  state.waveIndex += 1;
  state.phase = 'build';
  clearSoldiersAfterWave(state);
  state.boilerRuntime = {};
  state.steamTurretRuntime = {};
  captureBuildBaseline(state);
  addMessage(state, `Reinforce the tower for wave ${state.levelIndex + 1}.`, 'info');
}

export function loseGame(state: GameState): void {
  state.scene = 'gameOver';
  addMessage(state, 'The wizard has fallen. The tower is overrun.', 'combat');
}

export function winGame(state: GameState): void {
  state.scene = 'victory';
  addMessage(state, 'All waves repelled. The tower stands triumphant!', 'info');
}
