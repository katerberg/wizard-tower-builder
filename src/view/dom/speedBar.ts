import type { Intent } from '@/store/intents';
import type { Store } from '@/store/store';
import type { SimSpeed } from '@/model/types';

const SPEEDS: { speed: SimSpeed; label: string }[] = [
  { speed: 1, label: 'Normal' },
  { speed: 2, label: 'Fast' },
  { speed: 4, label: 'Fastest' },
];

export function createSpeedBar(root: HTMLElement, store: Store): () => void {
  root.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const target =
      e.target instanceof HTMLElement
        ? e.target.closest<HTMLElement>('[data-speed]')
        : null;
    if (!target) return;
    const speed = Number(target.dataset.speed) as SimSpeed;
    if (speed !== 1 && speed !== 2 && speed !== 4) return;
    store.dispatch({ type: 'setSimSpeed', speed } satisfies Intent);
  });

  return function render(): void {
    const { game } = store.getSnapshot();
    const inAttack = game.scene === 'run' && game.phase === 'attack';
    const active = game.simSpeed;

    const buttons = SPEEDS.map(
      ({ speed, label }) =>
        `<button type="button" class="speed-btn${active === speed ? ' active' : ''}" data-speed="${speed}" ${
          inAttack ? '' : 'disabled'
        }>${label}</button>`,
    ).join('');

    root.innerHTML = `
      <div class="speed-bar-inner${inAttack ? '' : ' dimmed'}">
        <span class="speed-label">Speed</span>
        <div class="speed-buttons">${buttons}</div>
      </div>`;
  };
}
