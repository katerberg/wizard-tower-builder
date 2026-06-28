import { addMessage } from './messages';
import { reward } from '../calculations/economy';
import { runWaveClearedEffects } from './modifications/effects';
import { linearProgression } from './waves';
import { buildSpawnQueue } from './waves';
import type { GameState } from './types';

export function startRun(state: GameState): void {
  state.scene = 'run';
  state.phase = 'build';
  addMessage(state, `Build your tower, then start wave ${state.levelIndex + 1}.`, 'info');
}

export function beginWave(state: GameState): void {
  const wave = linearProgression.getWave(state.levelIndex);
  state.phase = 'attack';
  state.enemies = [];
  state.spawnQueue = buildSpawnQueue(wave);
  state.spawnTimer = 0;
  state.waveTimer = 0;
  state.roomEffectTimers = {};
  addMessage(state, `Wave ${state.levelIndex + 1} incoming: ${state.spawnQueue.length} foes.`, 'combat');
}

export function endWave(state: GameState): void {
  const amount = linearProgression.rewardFor(state.levelIndex);
  reward(state, amount);
  addMessage(state, `Wave ${state.levelIndex + 1} cleared! +${amount} gold.`, 'economy');
  runWaveClearedEffects(state);

  if (linearProgression.isFinalLevel(state.levelIndex)) {
    winGame(state);
    return;
  }

  state.levelIndex += 1;
  state.waveIndex += 1;
  state.phase = 'build';
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
