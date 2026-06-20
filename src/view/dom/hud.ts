import { FINAL_LEVEL_INDEX } from '@/model/waves';
import { selectTowerStability } from '@/store/selectors';
import type { Intent } from '@/store/intents';
import type { Store } from '@/store/store';

export function createHud(root: HTMLElement, store: Store): () => void {
  root.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest('[data-action]') as HTMLElement | null;
    if (!target || (target as HTMLButtonElement).disabled) return;
    const action = target.dataset.action as Intent['type'];
    store.dispatch({ type: action } as Intent);
  });

  return function render(): void {
    const snapshot = store.getSnapshot();
    const { game } = snapshot;
    const { player } = game;
    const level = `${game.levelIndex + 1} / ${FINAL_LEVEL_INDEX + 1}`;
    const enemiesLeft = game.enemies.length + game.spawnQueue.length;

    const inBuild = game.scene === 'run' && game.phase === 'build';
    const stability = selectTowerStability(snapshot);
    const phaseControls = inBuild
      ? `${stability.stable ? '' : '<p class="warning">Tower unstable: floating rooms must be supported or removed.</p>'}
         <button class="primary" data-action="startWave" ${stability.stable ? '' : 'disabled'}>Start Wave ${game.levelIndex + 1}</button>`
      : '';

    const attackInfo =
      game.scene === 'run' && game.phase === 'attack'
        ? `<div class="stat"><span>Enemies</span><strong>${enemiesLeft}</strong></div>`
        : '';

    const devControls = game.devMode
      ? `<div class="dev-row">
           <button data-action="devAddCurrency">+50 mana</button>
           <button data-action="devSkipWave">Skip wave</button>
         </div>`
      : '';

    root.innerHTML = `
      <h1>Wizard Tower</h1>
      <div class="stat"><span>Phase</span><strong>${labelPhase(game.scene, game.phase)}</strong></div>
      <div class="stat"><span>Level</span><strong>${level}</strong></div>
      <div class="stat"><span>Mana</span><strong>${player.currency}</strong></div>
      <div class="stat"><span>Wizard HP</span><strong>${player.wizard.hp} / ${player.wizard.maxHp}</strong></div>
      ${attackInfo}
      ${phaseControls}
      <div class="dev-row">
        <button data-action="toggleDevMode">${game.devMode ? 'Dev: on' : 'Dev: off'}</button>
      </div>
      ${devControls}
    `;
  };
}

function labelPhase(scene: string, phase: string): string {
  if (scene === 'menu') return 'Menu';
  if (scene === 'gameOver') return 'Defeated';
  if (scene === 'victory') return 'Victory';
  return phase === 'build' ? 'Building' : 'Under Attack';
}
