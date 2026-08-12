import { describe, expect, it } from 'vitest';
import { Store } from './store';

describe('wave clear haul modal', () => {
  it('opens a waveClear modal after the wave ends with haul totals', () => {
    const store = new Store('haul-modal');
    store.dispatch({ type: 'startWave' });
    const game = store.getSnapshot().game;
    expect(game.phase).toBe('attack');
    game.waveHaul.stone = 7;
    game.enemies = [];
    game.spawnQueue = [];

    store.advance(0.05);
    store.flush();

    expect(game.phase).toBe('build');
    expect(game.pendingWaveClear?.haul.stone).toBe(7);
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
