import { selectResearchPanel } from '@/store/selectors';
import type { Store } from '@/store/store';

export function createResearchPanel(root: HTMLElement, store: Store): () => void {
  root.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const target =
      e.target instanceof HTMLElement
        ? e.target.closest<HTMLElement>('[data-action="openResearchModal"]')
        : null;
    if (!target || (target instanceof HTMLButtonElement && target.disabled)) return;
    store.dispatch({ type: 'openResearchModal' });
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
      : '<p class="research-hint">No active research.</p>';

    const queueHtml =
      panel.queue.length > 0
        ? `<p class="research-queue-summary">Queue (${panel.queue.length}): ${panel.queue
            .map((q) => q.name)
            .join(' → ')}</p>`
        : '';

    root.innerHTML = `
      <h2>Research</h2>
      ${activeHtml}
      ${queueHtml}
      <button class="primary" data-action="openResearchModal">${panel.ctaLabel}</button>
    `;
  };
}
