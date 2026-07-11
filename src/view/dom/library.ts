import { selectLibraryBlueprints } from '@/store/selectors';
import type { Store } from '@/store/store';

export function createLibrary(root: HTMLElement, store: Store): () => void {
  root.addEventListener('click', (e) => {
    const snapshot = store.getSnapshot();
    if (snapshot.game.phase !== 'build') return;

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
    const snapshot = store.getSnapshot();
    const { game } = snapshot;
    const inBuild = game.scene === 'run' && game.phase === 'build';

    if (!inBuild) {
      root.innerHTML = '';
      root.hidden = true;
      return;
    }

    root.hidden = false;
    const inSelectMode = snapshot.view.selectedBlueprintId === null;
    const blueprints = selectLibraryBlueprints(snapshot);

    const hand = `
      <button class="tool ${inSelectMode ? 'selected' : ''}" data-tool="select" data-tip-kind="tool" data-tip-id="select">
        <span class="tool-glyph">✋</span>
        <span class="tool-name">Select</span>
      </button>`;

    const items = blueprints
      .map((b) => {
        const selected = b.selected ? 'selected' : '';
        const poor = b.affordable ? '' : 'unaffordable';
        const tag = b.category === 'infra' ? 'infra' : 'structure';
        const hp = b.category === 'infra' ? 'utility' : `${b.baseHp} hp`;
        return `
        <button class="blueprint ${selected} ${poor}" data-tool="blueprint" data-blueprint="${b.id}" data-category="${tag}" data-tip-kind="blueprint" data-tip-id="${b.id}">
          <span class="bp-glyph">${b.glyph}</span>
          <span class="bp-name">${b.name}</span>
          <span class="bp-meta">${b.sizeW}x${b.sizeH} · ${b.cost} gold · ${hp}</span>
        </button>`;
      })
      .join('');

    root.innerHTML = `
      <h2>Build</h2>
      ${hand}
      <div class="blueprint-list">${items}</div>
      <p class="hint">Select: inspect rooms · Structure/Infra blueprints: click or drag · right-click removes room or infra · Esc cancels.</p>`;
  };
}
