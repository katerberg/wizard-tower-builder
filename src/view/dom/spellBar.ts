import { getSpell } from '@/model/spells';
import { selectMana, selectSpellBar } from '@/store/selectors';
import type { Store } from '@/store/store';

function renderSlot(
  slot: ReturnType<typeof selectSpellBar>[number],
  inAttack: boolean,
): string {
  const hotkey = `<span class="spell-hotkey">${slot.hotkey}</span>`;

  if (slot.empty) {
    return `<div class="spell-slot empty">${hotkey}</div>`;
  }

  if (!inAttack) {
    return `
      <div class="spell-slot preview" data-tip-kind="spell" data-tip-id="${slot.id}">
        ${hotkey}
        <span class="spell-glyph">${slot.glyph}</span>
        <span class="spell-cost">${slot.manaCost}</span>
      </div>`;
  }

  const selected = slot.selected ? 'selected' : '';
  const disabled = slot.enabled ? '' : 'disabled';
  const cd =
    slot.cooldownRemaining > 0
      ? `<span class="spell-cd">${slot.cooldownRemaining.toFixed(1)}s</span>`
      : '';

  return `
    <button class="spell-slot ${selected} ${disabled}" data-spell="${slot.id}" data-tip-kind="spell" data-tip-id="${slot.id}">
      ${hotkey}
      <span class="spell-glyph">${slot.glyph}</span>
      <span class="spell-cost">${slot.manaCost}</span>
      ${cd}
    </button>`;
}

export function createSpellBar(root: HTMLElement, store: Store): () => void {
  root.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const { game } = store.getSnapshot();
    if (game.phase !== 'attack') return;

    const target =
      e.target instanceof HTMLElement ? e.target.closest<HTMLElement>('[data-spell]') : null;
    if (!target?.dataset.spell || target.classList.contains('disabled')) return;

    const spellId = target.dataset.spell;
    const { view } = store.getSnapshot();
    if (view.selectedSpellId === spellId) {
      const spell = getSpell(spellId);
      if (spell?.targeting === 'self') {
        store.dispatch({ type: 'castSpellAt', spellId, cell: { col: 0, row: 0 } });
      } else {
        store.dispatch({ type: 'cancelCast' });
      }
    } else {
      store.dispatch({ type: 'selectSpell', spellId });
    }
  });

  return function render(): void {
    const snapshot = store.getSnapshot();
    const { game } = snapshot;
    const inRun = game.scene === 'run';

    if (!inRun) {
      root.innerHTML = '';
      root.hidden = true;
      return;
    }

    root.hidden = false;
    const inAttack = game.phase === 'attack';
    const { current, max, label } = selectMana(snapshot);
    const slots = selectSpellBar(snapshot);
    const hint = inAttack
      ? 'Press 1–6 or click a slot · click grid to cast · Esc cancels · Wand Strike auto-fires'
      : 'Mana refills each wave · spells activate during attack';

    root.innerHTML = `
      <h2>Spells</h2>
      <div class="mana-bar">
        <span class="mana-label">Mana</span>
        <div class="mana-track"><div class="mana-fill" style="width:${(current / max) * 100}%"></div></div>
        <span class="mana-text">${label}</span>
      </div>
      <div class="spell-bar">${slots.map((slot) => renderSlot(slot, inAttack)).join('')}</div>
      <p class="hint">${hint}</p>`;
  };
}
