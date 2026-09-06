import { isSlotRoom } from '@/model/staff/capacity';
import { roomAt, structureAt } from '@/model/tower';
import type { HandlerContext } from '../context';
import type { Intent } from '../intents';
import { setModal } from '../viewState';

function inDayPhase(ctx: HandlerContext): boolean {
  return ctx.game.scene === 'run' && ctx.game.phase === 'day';
}

export function handleInspectIntent(ctx: HandlerContext, intent: Intent): void {
  switch (intent.type) {
    case 'selectBlueprint':
      if (!inDayPhase(ctx)) return;
      ctx.view.selectedBlueprintId = intent.blueprintId;
      break;
    case 'hoverCell':
      ctx.view.hoveredCell = intent.cell;
      break;
    case 'inspectRoomAt': {
      if (!inDayPhase(ctx)) return;
      const room = roomAt(ctx.game.tower, intent.cell.col, intent.cell.row);
      if (room) {
        ctx.view.selectedBlueprintId = null;
        setModal(ctx.view, ctx.game, { kind: 'room', roomId: room.id });
        ctx.view.connectivityFocusSlotId = isSlotRoom(room) ? room.id : null;
        break;
      }
      const structure = structureAt(ctx.game.tower, intent.cell.col, intent.cell.row);
      if (structure) {
        ctx.view.selectedBlueprintId = null;
        setModal(ctx.view, ctx.game, { kind: 'structure', structureId: structure.id });
        ctx.view.connectivityFocusSlotId = null;
      }
      break;
    }
    case 'toggleLayer': {
      const current = ctx.view.layerVisibility[intent.layer];
      ctx.view.layerVisibility[intent.layer] = !current;
      break;
    }
    case 'closeModal':
      setModal(ctx.view, ctx.game, null);
      ctx.game.pendingWaveClear = null;
      ctx.view.connectivityFocusSlotId = null;
      break;
  }
}
