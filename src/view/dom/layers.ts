import type { TowerLayer } from '@/store/intents';
import type { Store } from '@/store/store';

const LAYERS: { id: TowerLayer; label: string }[] = [
  { id: 'rooms', label: 'Rooms' },
  { id: 'infra', label: 'Infra' },
  { id: 'workers', label: 'Workers' },
];

export function createLayersPanel(root: HTMLElement, store: Store): () => void {
  root.addEventListener('click', (e) => {
    const target =
      e.target instanceof HTMLElement ? e.target.closest<HTMLElement>('[data-layer]') : null;
    if (!target) return;
    const layer = target.dataset.layer as TowerLayer | undefined;
    if (!layer) return;
    store.dispatch({ type: 'toggleLayer', layer });
  });

  return function render(): void {
    const { layerVisibility } = store.getSnapshot().view;
    const buttons = LAYERS.map(
      ({ id, label }) =>
        `<button class="layer-btn ${layerVisibility[id] ? 'on' : 'off'}" data-layer="${id}">${label}</button>`,
    ).join('');
    root.innerHTML = `<h2>Layers</h2><div class="layer-row">${buttons}</div>`;
  };
}
