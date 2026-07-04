import { BLUEPRINTS } from '@/model/blueprints';
import { selectBuildEconomy } from '@/store/selectors';
import type { Store } from '@/store/store';

export function createLibrary(root: HTMLElement, store: Store): () => void {
  root.addEventListener('click', (e) => {
    const target =
      e.target instanceof HTMLElement ? e.target.closest<HTMLElement>('[data-tool]') : null;
    if (!target) return;

    const tool = target.dataset.tool;
    if (tool === 'select') {
      store.dispatch({ type: 'selectBlueprint', blueprintId: null });
      return;
    }

    const blueprintId = target.dataset.blueprint;
    if (!blueprintId) return;

    const { view } = store.getSnapshot();
    if (view.selectedBlueprintId === blueprintId) {
      store.dispatch({ type: 'selectBlueprint', blueprintId: null });
    } else {
      store.dispatch({ type: 'selectBlueprint', blueprintId });
    }
  });

  return function render(): void {
    const { view } = store.getSnapshot();
    const { remainingGold } = selectBuildEconomy(store.getSnapshot());
    const affordable = (cost: number) => remainingGold >= cost;
    const inSelectMode = view.selectedBlueprintId === null;

    const hand = `
      <button class="tool ${inSelectMode ? 'selected' : ''}" data-tool="select" title="Select rooms to inspect and modify">
        <span class="tool-glyph">✋</span>
        <span class="tool-name">Select</span>
      </button>`;

    const items = BLUEPRINTS.map((b) => {
      const selected = view.selectedBlueprintId === b.id ? 'selected' : '';
      const poor = affordable(b.cost) ? '' : 'unaffordable';
      return `
        <button class="blueprint ${selected} ${poor}" data-tool="blueprint" data-blueprint="${b.id}">
          <span class="bp-glyph">${b.glyph}</span>
          <span class="bp-name">${b.name}</span>
          <span class="bp-meta">${b.size.w}x${b.size.h} · ${b.cost} gold · ${b.baseHp} hp</span>
        </button>`;
    }).join('');

    root.innerHTML = `
      <h2>Build</h2>
      ${hand}
      <div class="blueprint-list">${items}</div>
      <p class="hint">Select tool: click rooms to modify · Blueprint: click or drag to place · right-click to remove · Esc cancels blueprint.</p>`;
  };
}
