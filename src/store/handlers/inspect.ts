import { isSlotRoom } from '@/model/soldiers/capacity';
import { roomAt } from '@/model/tower';
import type { HandlerContext } from '../context';
import type { Intent } from '../intents';

export function handleInspectIntent(ctx: HandlerContext, intent: Intent): void {
  switch (intent.type) {
    case 'selectBlueprint':
      ctx.view.selectedBlueprintId = intent.blueprintId;
      break;
    case 'hoverCell':
      ctx.view.hoveredCell = intent.cell;
      break;
    case 'inspectRoomAt': {
      const room = roomAt(ctx.game.tower, intent.cell.col, intent.cell.row);
      if (room) {
        ctx.view.selectedBlueprintId = null;
        ctx.view.modal = { kind: 'room', roomId: room.id };
        ctx.view.connectivityFocusSlotId = isSlotRoom(room) ? room.id : null;
      }
      break;
    }
    case 'toggleLayer': {
      const current = ctx.view.layerVisibility[intent.layer];
      ctx.view.layerVisibility[intent.layer] = !current;
      break;
    }
    case 'closeModal':
      ctx.view.modal = null;
      ctx.view.connectivityFocusSlotId = null;
      break;
  }
}
