import { BLUEPRINTS } from '@/model/blueprints';
import { selectBuildEconomy } from '@/store/selectors';
import type { Store } from '@/store/store';

export function createLibrary(root: HTMLElement, store: Store): () => void {
  root.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest('[data-blueprint]') as HTMLElement | null;
    if (!target) return;
    store.dispatch({ type: 'selectBlueprint', blueprintId: target.dataset.blueprint! });
  });

  return function render(): void {
    const { view } = store.getSnapshot();
    const { remainingGold } = selectBuildEconomy(store.getSnapshot());
    const affordable = (cost: number) => remainingGold >= cost;

    const items = BLUEPRINTS.map((b) => {
      const selected = view.selectedBlueprintId === b.id ? 'selected' : '';
      const poor = affordable(b.cost) ? '' : 'unaffordable';
      return `
        <button class="blueprint ${selected} ${poor}" data-blueprint="${b.id}">
          <span class="bp-glyph">${b.glyph}</span>
          <span class="bp-name">${b.name}</span>
          <span class="bp-meta">${b.size.w}x${b.size.h} · ${b.cost} gold · ${b.baseHp} hp</span>
        </button>`;
    }).join('');

    root.innerHTML = `<h2>Blueprints</h2>${items}<p class="hint">Click or drag to place · right-click to remove · rearrange freely until you start the wave.</p>`;
  };
}
