import { FINAL_LEVEL_INDEX } from '@/model/waves';
import { selectBuildEconomy, selectBuildUndoState, selectMana, selectSelectedBlueprint, selectTowerStability } from '@/store/selectors';
import type { Intent } from '@/store/intents';
import type { Store } from '@/store/store';

export function createHud(root: HTMLElement, store: Store): () => void {
  function dispatchFromTarget(eventTarget: EventTarget | null): void {
    const target =
      eventTarget instanceof HTMLElement
        ? eventTarget.closest<HTMLElement>('[data-action]')
        : null;
    if (!target || (target instanceof HTMLButtonElement && target.disabled)) return;
    const action = target.dataset.action as Intent['type'] | undefined;
    if (!action) return;
    store.dispatch({ type: action } as Intent);
  }

  // Use pointerdown, not click: during the attack phase the HUD re-renders every
  // frame, so a button is replaced between a click's mousedown and mouseup and
  // the click never fires. pointerdown runs on press, before the next re-render.
  root.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    dispatchFromTarget(e.target);
  });

  // Keep keyboard activation working for focused buttons.
  root.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    dispatchFromTarget(e.target);
  });

  return function render(): void {
    const snapshot = store.getSnapshot();
    const { game } = snapshot;
    const { player } = game;
    const level = `${game.levelIndex + 1} / ${FINAL_LEVEL_INDEX + 1}`;
    const enemiesLeft = game.enemies.length + game.spawnQueue.length;

    const inBuild = game.scene === 'run' && game.phase === 'build';
    const stability = selectTowerStability(snapshot);
    const economy = selectBuildEconomy(snapshot);
    const undoState = selectBuildUndoState(snapshot);
    const selectedBlueprint = selectSelectedBlueprint(snapshot);
    const buildModeHint =
      inBuild && selectedBlueprint
        ? `<p class="mode-hint">Placing: ${selectedBlueprint.name}</p>`
        : inBuild
          ? '<p class="mode-hint">Select rooms to modify</p>'
          : '';
    const goldLabel =
      economy.isPlanning && economy.committedGold > 0
        ? `${economy.remainingGold} (${economy.committedGold} committed)`
        : `${economy.remainingGold}`;
    const phaseControls = inBuild
      ? `<div class="build-undo-row">
           <button data-action="undoBuild" ${undoState.canUndo ? '' : 'disabled'}>Undo</button>
           <button data-action="revertBuild" ${undoState.canRevert ? '' : 'disabled'}>Revert all</button>
         </div>
         ${stability.stable ? '' : '<p class="warning">Tower unstable: floating rooms must be supported or removed.</p>'}
         <button class="primary" data-action="startWave" ${stability.stable ? '' : 'disabled'}>Start Wave ${game.levelIndex + 1}</button>`
      : '';

    const attackInfo =
      game.scene === 'run' && game.phase === 'attack'
        ? `<div class="stat"><span>Enemies</span><strong>${enemiesLeft}</strong></div>
           <div class="stat"><span>Mana</span><strong>${selectMana(snapshot).current} / ${selectMana(snapshot).max}</strong></div>`
        : '';

    const devControls = game.devMode
      ? `<div class="dev-row">
           <button data-action="devAddCurrency">+50 gold</button>
           <button data-action="devSkipWave">Skip wave</button>
         </div>`
      : '';

    root.innerHTML = `
      <h1>Wizard Tower</h1>
      <div class="stat"><span>Phase</span><strong>${labelPhase(game.scene, game.phase)}</strong></div>
      <div class="stat"><span>Level</span><strong>${level}</strong></div>
      <div class="stat"><span>Gold</span><strong>${goldLabel}</strong></div>
      <div class="stat"><span>Wizard HP</span><strong>${player.wizard.hp} / ${player.wizard.maxHp}</strong></div>
      ${attackInfo}
      ${buildModeHint}
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
