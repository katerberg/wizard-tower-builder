import { formatResourceAmount } from '@/calculations/resources';
import { WIN_HEIGHT } from '@/model/waves';
import { completedTowerExtents } from '@/model/tower';
import {
  selectBuildEconomy,
  selectBuildUndoState,
  selectPhaseInfo,
  selectLogisticsReport,
  selectMana,
  selectProspectAllocation,
  selectSelectedBlueprint,
} from '@/store/selectors';
import type { Intent } from '@/store/intents';
import type { Store } from '@/store/store';

export function createHud(root: HTMLElement, store: Store): () => void {
  function dispatchFromTarget(eventTarget: EventTarget | null): void {
    const target =
      eventTarget instanceof HTMLElement
        ? eventTarget.closest<HTMLElement>('[data-action]')
        : null;
    if (!target || (target instanceof HTMLButtonElement && target.disabled)) return;
    const action = target.dataset.action;
    if (!action) return;
    if (action === 'devSetSpellSchool') {
      const school = target.dataset.school;
      if (school === 'fire' || school === 'air' || school === 'earth' || school === 'water') {
        store.dispatch({ type: 'devSetSpellSchool', school });
      }
      return;
    }
    if (action === 'prospectMinus' || action === 'prospectPlus') {
      const snapshot = store.getSnapshot();
      const prospect = selectProspectAllocation(snapshot);
      const count = action === 'prospectMinus' ? prospect.current - 1 : prospect.current + 1;
      store.dispatch({ type: 'setProspectAllocation', count });
      return;
    }
    store.dispatch({ type: action as Intent['type'] } as Intent);
  }

  root.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    dispatchFromTarget(e.target);
  });

  root.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    dispatchFromTarget(e.target);
  });

  return function render(): void {
    const snapshot = store.getSnapshot();
    const { game } = snapshot;
    const height = completedTowerExtents(game.tower).maxOccupiedRow;
    const enemiesLeft = game.enemies.length + game.spawnQueue.length;
    const phaseInfo = selectPhaseInfo(snapshot);

    const inDay = game.scene === 'run' && game.phase === 'day';
    const economy = selectBuildEconomy(snapshot);
    const undoState = selectBuildUndoState(snapshot);
    const selectedBlueprint = selectSelectedBlueprint(snapshot);
    const buildModeHint =
      inDay && selectedBlueprint
        ? `<p class="mode-hint">Placing: ${selectedBlueprint.name}</p>`
        : inDay
          ? '<p class="mode-hint">Paint construction plans</p>'
          : '';
    const r = economy.remaining;
    const committed = economy.committed;
    const showCommitted =
      economy.isPlanning &&
      (committed.gold > 0 || committed.metal > 0 || committed.stone > 0 || committed.souls > 0);
    const fmt = (n: number, c: number) => {
      const amount = formatResourceAmount(n);
      return showCommitted && c > 0 ? `${amount} (${formatResourceAmount(c)} in)` : amount;
    };
    const goldLabel = fmt(r.gold, committed.gold);
    const metalLabel = fmt(r.metal, committed.metal);
    const stoneLabel = fmt(r.stone, committed.stone);
    const soulsLabel = fmt(r.souls, committed.souls);
    const logistics = inDay ? selectLogisticsReport(snapshot.game) : null;
    const logisticsHtml =
      logistics && logistics.warnings.length > 0
        ? `<p class="warning">${logistics.warnings[0]}${logistics.warnings.length > 1 ? ` (+${logistics.warnings.length - 1} more)` : ''}</p>`
        : '';

    const timerSec = Math.max(0, Math.ceil(phaseInfo.phaseTimer));
    const cycleIcon = phaseInfo.phase === 'day' ? '☀' : '☾';
    const cycleLabel = phaseInfo.phase === 'day' ? 'Day' : 'Night';

    const phaseControls = inDay
      ? `<div class="build-undo-row">
           <button data-action="undoBuild" ${undoState.canUndo ? '' : 'disabled'}>Undo</button>
           <button data-action="revertBuild" ${undoState.canRevert ? '' : 'disabled'}>Cancel all</button>
         </div>
         ${logisticsHtml}`
      : '';

    const attackInfo =
      game.scene === 'run' && game.phase === 'night'
        ? `<div class="stat"><span>Enemies</span><strong>${enemiesLeft}</strong></div>
           <div class="stat"><span>Mana</span><strong>${selectMana(snapshot).label}</strong></div>`
        : '';

    const waveBuilderOpen = snapshot.view.waveBuilder.open;
    const devControls = game.devMode
      ? `<div class="dev-row">
           <button data-action="devAddCurrency">+50 all</button>
           <button data-action="devSkipWave">Skip wave</button>
           <button data-action="devUnlockAll">Unlock all</button>
         </div>
         <div class="dev-row">
           <button data-action="toggleWaveBuilder">${waveBuilderOpen ? 'Wave builder: on' : 'Wave builder'}</button>
           <button data-action="startWave">Skip to night</button>
         </div>
         <div class="dev-row">
           <button data-action="devSetSpellSchool" data-school="fire" ${game.activeSpellSchool === 'fire' ? 'disabled' : ''}>Fire school</button>
           <button data-action="devSetSpellSchool" data-school="air" ${game.activeSpellSchool === 'air' ? 'disabled' : ''}>Air school</button>
           <button data-action="devSetSpellSchool" data-school="earth" ${game.activeSpellSchool === 'earth' ? 'disabled' : ''}>Earth school</button>
           <button data-action="devSetSpellSchool" data-school="water" ${game.activeSpellSchool === 'water' ? 'disabled' : ''}>Water school</button>
         </div>`
      : '';

    const prospect = inDay ? selectProspectAllocation(snapshot) : null;
    const prospectHtml = inDay
      ? `<div class="stat"><span>Prospectors</span><strong>${prospect?.current ?? 0} / ${prospect?.max ?? 0}</strong></div>
         <div class="slot-stepper">
           <button class="stepper-btn ${prospect && prospect.current <= 0 ? 'disabled' : ''}" data-action="prospectMinus">−</button>
           <button class="stepper-btn ${prospect && prospect.current >= prospect.max ? 'disabled' : ''}" data-action="prospectPlus">+</button>
         </div>`
      : '';

    root.innerHTML = `
      <h1>Wizard Tower</h1>
      <div class="stat"><span>${cycleIcon} ${cycleLabel} ${phaseInfo.dayIndex}</span><strong>${timerSec}s</strong></div>
      <div class="stat"><span>Height</span><strong>${height} / ${WIN_HEIGHT}</strong></div>
      <div class="stat"><span>Gold</span><strong>${goldLabel}</strong></div>
      <div class="stat"><span>Metal</span><strong>${metalLabel}</strong></div>
      <div class="stat"><span>Stone</span><strong>${stoneLabel}</strong></div>
      <div class="stat"><span>Souls</span><strong>${soulsLabel}</strong></div>
      <div class="stat"><span>Collector HP</span><strong>${game.solarCollector.hp} / ${game.solarCollector.maxHp}</strong></div>
      ${attackInfo}
      ${prospectHtml}
      ${buildModeHint}
      ${phaseControls}
      <div class="dev-row">
        <button data-action="toggleDevMode">${game.devMode ? 'Dev: on' : 'Dev: off'}</button>
      </div>
      ${devControls}
    `;
  };
}
