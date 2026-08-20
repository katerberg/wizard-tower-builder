import type { Intent } from '@/store/intents';
import type { Store } from '@/store/store';
import { isSimSpeed, SIM_SPEEDS, type SimSpeed } from '@/model/types';

const LABELS: Record<SimSpeed, string> = {
  0: 'Pause',
  1: '1×',
  2: '2×',
  5: '5×',
};

export function createSpeedBar(root: HTMLElement, store: Store): () => void {
  root.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const target =
      e.target instanceof HTMLElement
        ? e.target.closest<HTMLElement>('[data-speed]')
        : null;
    if (!target) return;
    const speed = Number(target.dataset.speed);
    if (!isSimSpeed(speed)) return;
    store.dispatch({ type: 'setSimSpeed', speed } satisfies Intent);
  });

  return function render(): void {
    const { game } = store.getSnapshot();
    const active = game.simSpeed;

    const buttons = SIM_SPEEDS.map(
      (speed) =>
        `<button type="button" class="speed-btn${active === speed ? ' active' : ''}" data-speed="${speed}">${LABELS[speed]}</button>`,
    ).join('');

    root.innerHTML = `
      <div class="speed-bar-inner">
        <span class="speed-label">Sim speed</span>
        <div class="speed-buttons">${buttons}</div>
        <p class="speed-hint">Applies during day and night.</p>
      </div>`;
  };
}
