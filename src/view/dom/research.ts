import { selectResearchPanel } from '@/store/selectors';
import type { Store } from '@/store/store';

export function createResearchPanel(root: HTMLElement, store: Store): () => void {
  root.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const target =
      e.target instanceof HTMLElement
        ? e.target.closest<HTMLElement>('[data-action="startResearch"]')
        : null;
    if (!target || (target instanceof HTMLButtonElement && target.disabled)) return;
    const nodeId = target.dataset.node;
    if (!nodeId) return;
    store.dispatch({ type: 'startResearch', nodeId });
  });

  return function render(): void {
    const panel = selectResearchPanel(store.getSnapshot());
    if (!panel.visible) {
      root.hidden = true;
      root.innerHTML = '';
      return;
    }
    root.hidden = false;

    const activeHtml = panel.active
      ? `<div class="research-active">
           <strong>${panel.active.name}</strong>
           <div class="research-progress-track">
             <div class="research-progress-fill" style="width:${Math.round(panel.active.ratio * 100)}%"></div>
           </div>
           <span class="research-progress-label">${panel.active.progress.toFixed(0)} / ${panel.active.required}</span>
         </div>`
      : '<p class="research-hint">Pick a project, then assign magi to a Research Room.</p>';

    const items = panel.frontier
      .map(
        (item) => `
      <li class="research-item">
        <div>
          <strong>${item.name}</strong>
          <span class="research-meta">${item.costLabel} · ${item.progressRequired} labor</span>
          <p>${item.description}</p>
        </div>
        <button data-action="startResearch" data-node="${item.id}" ${
          item.affordable ? '' : 'disabled'
        }>Start</button>
      </li>`,
      )
      .join('');

    root.innerHTML = `
      <h2>Research</h2>
      ${activeHtml}
      <ul class="research-list">${items || '<li class="research-empty">No available projects.</li>'}</ul>
    `;
  };
}
