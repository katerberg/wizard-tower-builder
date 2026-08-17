import {
  PROSPECT_EQUIP_COST,
} from '@/config/constants';
import { netBuildCost } from '@/calculations/buildCost';
import { canAffordResources, subResources } from '@/calculations/resources';
import { beginRun, createInitialState } from '@/model/game';
import { addMessage } from '@/model/messages';
import { beginWave } from '@/model/phases';
import { isTowerStable } from '@/model/tower';
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
      startWave(ctx);
      break;
    case 'restart':
      restart(ctx);
      break;
  }
}

function startWave(ctx: HandlerContext): void {
  const { game } = ctx;
  if (game.scene !== 'run' || game.phase !== 'build') return;
  if (!isTowerStable(game.tower)) {
    addMessage(game, 'The tower is unstable. Remove or support floating rooms first.', 'info');
    return;
  }
  if (game.buildBaseline) {
    const net = netBuildCost(game.buildBaseline, game.tower);
    game.player.resources = subResources(
      subResources(game.buildBaseline.resources, net),
      { gold: game.buildRecruitSpend },
    );
  }

  // Charge prospect equip cost (stone + metal) when prospecting is active.
  if (game.prospectAllocation > 0) {
    const cost = PROSPECT_EQUIP_COST as import('@/model/types').ResourceCost;
    if (canAffordResources(game.player.resources, cost)) {
      game.player.resources = subResources(game.player.resources, cost);
    } else {
      // Can't afford — cancel prospecting.
      game.prospectAllocation = 0;
      addMessage(game, 'Not enough resources for prospecting equipment.', 'economy');
    }
  }

  // Reset prospect state for the new wave.
  game.prospectWorkElapsed = 0;
  game.prospectResolved = false;

  ctx.clearBuildHistory();
  const useCustom = game.devMode && ctx.view.waveBuilder.open;
  if (useCustom) {
    beginWave(game, waveDefFromCounts(ctx.view.waveBuilder.counts));
  } else {
    beginWave(game);
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
  };
}
