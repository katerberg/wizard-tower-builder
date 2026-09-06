import { describe, expect, it } from 'vitest';
import { Store } from '../store';

describe('research modal sim pause', () => {
  it('pauses on open and restores previous speed on close', () => {
    const store = new Store('research-pause');
    store.dispatch({ type: 'setSimSpeed', speed: 2 });
    expect(store.getSimSpeed()).toBe(2);

    store.dispatch({ type: 'openResearchModal' });
    expect(store.getSnapshot().view.modal?.kind).toBe('research');
    expect(store.getSimSpeed()).toBe(0);

    store.dispatch({ type: 'closeModal' });
    expect(store.getSnapshot().view.modal).toBeNull();
    expect(store.getSimSpeed()).toBe(2);
  });

  it('remembers a speed change made while the modal is open', () => {
    const store = new Store('research-pause-speed');
    store.dispatch({ type: 'setSimSpeed', speed: 5 });
    store.dispatch({ type: 'openResearchModal' });
    store.dispatch({ type: 'setSimSpeed', speed: 1 });
    expect(store.getSimSpeed()).toBe(0);

    store.dispatch({ type: 'closeModal' });
    expect(store.getSimSpeed()).toBe(1);
  });
});
