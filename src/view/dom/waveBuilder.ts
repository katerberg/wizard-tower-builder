import { selectWaveBuilderSummary } from '@/store/selectors';
import type { Store } from '@/store/store';

export function createWaveBuilder(root: HTMLElement, store: Store): () => void {
  // pointerdown: attack-phase re-renders replace buttons between mousedown/mouseup.
  root.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const target =
      e.target instanceof HTMLElement ? e.target.closest<HTMLElement>('[data-action]') : null;
    if (!target || (target instanceof HTMLButtonElement && target.disabled)) return;
    const action = target.dataset.action;
    if (action === 'devSetWaveCount') {
      const templateId = target.dataset.templateId;
      const count = Number(target.dataset.count);
      if (!templateId || !Number.isFinite(count)) return;
      store.dispatch({ type: 'devSetWaveCount', templateId, count });
      return;
    }
    if (action === 'devClearWaveBuilder' || action === 'devLoadCurrentWave') {
      store.dispatch({ type: action });
    }
  });

  root.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const target =
      e.target instanceof HTMLElement ? e.target.closest<HTMLElement>('[data-action]') : null;
    if (!target) return;
    e.preventDefault();
    target.dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true }));
  });

  return function render(): void {
    const summary = selectWaveBuilderSummary(store.getSnapshot());
    if (!summary.visible) {
      root.hidden = true;
      root.innerHTML = '';
      return;
    }
    root.hidden = false;

    const rows = summary.rows
      .map((row) => {
        const dec = Math.max(0, row.count - 1);
        const inc = row.count + 1;
        return `<div class="wave-builder-row">
          <span class="wave-builder-glyph" style="color:${row.color}">${row.glyph}</span>
          <span class="wave-builder-name">${row.name}</span>
          <span class="wave-builder-cost">${row.pointCost}pt</span>
          <button type="button" data-action="devSetWaveCount" data-template-id="${row.templateId}" data-count="${dec}" ${row.count <= 0 ? 'disabled' : ''}>−</button>
          <strong class="wave-builder-count">${row.count}</strong>
          <button type="button" data-action="devSetWaveCount" data-template-id="${row.templateId}" data-count="${inc}">+</button>
        </div>`;
      })
      .join('');

    root.innerHTML = `
      <h2>Wave builder</h2>
      <p class="wave-builder-hint">Start Wave uses this draft while open. Sides alternate L/R.</p>
      <div class="wave-builder-summary">
        <div class="stat"><span>Score</span><strong>${summary.score}</strong></div>
        <div class="stat"><span>~Height</span><strong>${summary.estimatedHeight}</strong></div>
        <div class="stat"><span>~Budget</span><strong>${summary.estimatedBudget}</strong></div>
        <div class="stat"><span>Foes</span><strong>${summary.totalFoes}</strong></div>
        <div class="stat"><span>Tower ht</span><strong>${summary.currentHeight}</strong></div>
        <div class="stat"><span>Ht budget</span><strong>${summary.currentBudget}</strong></div>
        <div class="stat"><span>Clear gold</span><strong>${summary.clearGold}</strong></div>
      </div>
      <div class="wave-builder-rows">${rows}</div>
      <div class="dev-row">
        <button type="button" data-action="devLoadCurrentWave">Load current</button>
        <button type="button" data-action="devClearWaveBuilder">Clear</button>
      </div>
    `;
  };
}
