import { netBuildCost } from '@/calculations/buildCost';
import { beginRun, createInitialState } from '@/model/game';
import { addMessage } from '@/model/messages';
import { beginWave } from '@/model/phases';
import { isTowerStable } from '@/model/tower';
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
    game.player.currency = game.buildBaseline.currency - net - game.buildRecruitSpend;
  }
  ctx.clearBuildHistory();
  beginWave(game);
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
    layerVisibility: { rooms: true, infra: true, soldiers: true },
    connectivityFocusSlotId: null,
  };
}
