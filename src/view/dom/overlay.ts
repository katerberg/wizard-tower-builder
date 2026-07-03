import type { Store } from '@/store/store';

export function createOverlay(root: HTMLElement, store: Store): () => void {
  root.addEventListener('click', (e) => {
    const target =
      e.target instanceof HTMLElement ? e.target.closest<HTMLElement>('[data-action]') : null;
    if (!target) return;
    const action = target.dataset.action;
    if (action === 'beginRun') store.dispatch({ type: 'beginRun' });
    if (action === 'restart') store.dispatch({ type: 'restart' });
    if (action === 'help') store.dispatch({ type: 'closeModal' });
  });

  return function render(): void {
    const { game } = store.getSnapshot();
    if (game.scene === 'run') {
      root.style.display = 'none';
      return;
    }
    root.style.display = 'flex';

    let body = '';
    if (game.scene === 'menu') {
      body = `
        <h2>Wizard Tower Builder</h2>
        <p>Stack rooms into a tower and defend your wizard from climbing hordes.</p>
        <button class="primary" data-action="beginRun">Begin Run</button>`;
    } else if (game.scene === 'gameOver') {
      body = `
        <h2>Defeated</h2>
        <p>The wizard fell on wave ${game.levelIndex + 1}.</p>
        <button class="primary" data-action="restart">Try Again</button>`;
    } else if (game.scene === 'victory') {
      body = `
        <h2>Victory!</h2>
        <p>All ${game.levelIndex + 1} waves repelled. The tower stands.</p>
        <button class="primary" data-action="restart">Play Again</button>`;
    }

    root.innerHTML = `<div class="overlay-panel">${body}</div>`;
  };
}
