import { describe, expect, it } from 'vitest';
import { isFortified } from '@/model/spells';
import { Store } from '@/store/store';

describe('self-targeting spells', () => {
  it('instant-casts Fortify on selectSpell without a grid click', () => {
    const store = new Store('self0');
    store.dispatch({ type: 'devSetSpellSchool', school: 'earth' });
    store.dispatch({ type: 'startWave' });

    store.dispatch({ type: 'selectSpell', spellId: 'fortify' });

    const { game, view } = store.getSnapshot();
    expect(isFortified(game)).toBe(true);
    expect(view.selectedSpellId).toBeNull();
  });

  it('cancels Fortify via cancelCast after concentration starts', () => {
    const store = new Store('self1');
    store.dispatch({ type: 'devSetSpellSchool', school: 'earth' });
    store.dispatch({ type: 'startWave' });
    store.dispatch({ type: 'selectSpell', spellId: 'fortify' });
    expect(isFortified(store.getSnapshot().game)).toBe(true);

    store.dispatch({ type: 'cancelCast' });
    expect(isFortified(store.getSnapshot().game)).toBe(false);
  });
});
