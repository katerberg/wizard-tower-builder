import { PROSPECT_EQUIP_COST } from '@/config/constants';
import { canAffordResources, subResources } from '@/calculations/resources';
import { beginRun, createInitialState } from '@/model/game';
import { addMessage } from '@/model/messages';
import { endDay } from '@/model/phases';
import { waveDefFromCounts } from '@/model/waves';
import { resetToSelectMode } from '../viewState';
import type { HandlerContext } from '../context';
import type { Intent } from '../intents';

export function handleWaveIntent(ctx: HandlerContext, intent: Intent): void {
  switch (intent.type) {
    case 'beginRun':
      beginRun(ctx.game);
      ctx.clearBuildHistory();
      break;
    case 'startWave':
      skipToNight(ctx);
      break;
    case 'restart':
      restart(ctx);
      break;
    case 'togglePhasePause':
      ctx.game.phasePaused = !ctx.game.phasePaused;
      break;
  }
}

/** Dev / skip: force night immediately. */
function skipToNight(ctx: HandlerContext): void {
  const { game } = ctx;
  if (game.scene !== 'run' || game.phase !== 'day') return;

  if (game.prospectAllocation > 0) {
    const cost = PROSPECT_EQUIP_COST as import('@/model/types').ResourceCost;
    if (canAffordResources(game.player.resources, cost)) {
      game.player.resources = subResources(game.player.resources, cost);
    } else {
      game.prospectAllocation = 0;
      addMessage(game, 'Not enough resources for prospecting equipment.', 'economy');
    }
  }

  game.prospectWorkElapsed = 0;
  game.prospectResolved = false;
  game.phaseTimer = 0;
  ctx.clearBuildHistory();
  const useCustom = game.devMode && ctx.view.waveBuilder.open;
  if (useCustom) {
    endDay(game, waveDefFromCounts(ctx.view.waveBuilder.counts));
  } else {
    endDay(game);
  }
  resetToSelectMode(ctx.view);
}

function restart(ctx: HandlerContext): void {
  const viewportHeight = ctx.view.viewportHeight;
  ctx.game = createInitialState();
  beginRun(ctx.game);
  ctx.clearBuildHistory();
  ctx.view = {
    selectedBlueprintId: null,
    selectedSpellId: null,
    hoveredCell: null,
    castAnchor: null,
    modal: null,
    cameraScrollY: 0,
    viewportHeight,
    layerVisibility: { rooms: true, infra: true, workers: true },
    connectivityFocusSlotId: null,
    waveBuilder: { open: false, counts: {} },
    selectedResearchNodeId: null,
    researchExpandedGroupIds: [],
  };
}
