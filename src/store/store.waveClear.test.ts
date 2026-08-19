import { describe, expect, it } from 'vitest';
import { NIGHT_DURATION } from '@/config/dayNight';
import { FIXED_DT } from '@/config/constants';
import { Store } from './store';

describe('wave clear haul modal', () => {
  it('opens a waveClear modal at dawn after the wave ends with haul totals', () => {
    const store = new Store('haul-modal');
    store.dispatch({ type: 'toggleDevMode' });
    store.dispatch({ type: 'startWave' });
    const game = store.getSnapshot().game;
    expect(game.phase).toBe('night');
    game.waveHaul.stone = 7;
    game.enemies = [];
    game.spawnQueue = [];

    const nightSteps = Math.ceil(NIGHT_DURATION / FIXED_DT) + 5;
    for (let i = 0; i < nightSteps; i += 1) {
      store.advance(FIXED_DT);
    }
    store.flush();

    expect(store.getSnapshot().game.phase).toBe('day');
    expect(store.getSnapshot().game.pendingWaveClear?.haul.stone).toBe(7);
    const modal = store.getSnapshot().view.modal;
    expect(modal?.kind).toBe('waveClear');
    if (modal?.kind === 'waveClear') {
      expect(modal.haul.stone).toBe(7);
      expect(modal.gold).toBeGreaterThan(0);
    }

    store.dispatch({ type: 'closeModal' });
    expect(store.getSnapshot().view.modal).toBeNull();
    expect(store.getSnapshot().game.pendingWaveClear).toBeNull();
  });
});
