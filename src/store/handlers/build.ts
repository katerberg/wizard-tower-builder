import { getBlueprint } from '@/model/blueprints';
import { isInfraBlueprint } from '@/model/infraBlueprints';
import { isFortificationBlueprint } from '@/model/fortificationBlueprints';
import { addMessage } from '@/model/messages';
import { isOverhangUnlocked } from '@/model/research';
import {
  cancelConstructionOrder,
  createBuildOrder,
  createTeardownOrder,
  isLockedRoom,
} from '@/model/construction';
import { canPlace, roomAt, structureAt } from '@/model/tower';
import { SCAFFOLD_BLUEPRINT_ID } from '@/config/construction';
import type { HandlerContext } from '../context';
import type { Intent } from '../intents';

export function handleBuildIntent(ctx: HandlerContext, intent: Intent): void {
  switch (intent.type) {
    case 'placeSelectedAt':
      placeSelected(ctx, intent.cell);
      break;
    case 'removeRoomAt':
      removeAt(ctx, intent.cell);
      break;
    case 'sellRoom':
      sellRoomById(ctx, intent.roomId);
      break;
    case 'sellStructure':
      sellStructureById(ctx, intent.structureId);
      break;
    case 'undoBuild':
      undoLastOrder(ctx);
      break;
    case 'revertBuild':
      cancelAllOrders(ctx);
      break;
  }
}

function placeSelected(ctx: HandlerContext, cell: { col: number; row: number }): void {
  const { game, view } = ctx;
  if (game.phase !== 'day') return;
  const id = view.selectedBlueprintId;
  if (!id) return;
  if (isInfraBlueprint(id)) return;
  if (isFortificationBlueprint(id)) return;
  if (id === 'scaffold') return;

  const blueprint = getBlueprint(id);
  if (!blueprint) return;

  const result = canPlace(game.tower, blueprint, cell, { overhangUnlocked: isOverhangUnlocked(game) });
  if (!result.ok) {
    addMessage(game, `Cannot build here: ${result.reason.replace(/_/g, ' ')}.`, 'info');
    return;
  }

  createBuildOrder(game, id, cell, () => ctx.nextRoomId());
}

function removeAt(ctx: HandlerContext, cell: { col: number; row: number }): void {
  const room = roomAt(ctx.game.tower, cell.col, cell.row);
  if (room) {
    sellRoomById(ctx, room.id);
    return;
  }
  const structure = structureAt(ctx.game.tower, cell.col, cell.row);
  if (structure && structure.blueprintId !== SCAFFOLD_BLUEPRINT_ID) {
    sellStructureById(ctx, structure.id);
  }
}

function sellRoomById(ctx: HandlerContext, roomId: string): void {
  const { game } = ctx;
  if (game.phase !== 'day') return;
  if (isLockedRoom(game, roomId)) {
    addMessage(game, 'This room cannot be removed.', 'info');
    return;
  }
  createTeardownOrder(game, roomId);
}

function sellStructureById(ctx: HandlerContext, structureId: string): void {
  const { game } = ctx;
  if (game.phase !== 'day') return;
  const structure = (game.tower.structures ?? []).find((s) => s.id === structureId);
  if (!structure || structure.blueprintId === SCAFFOLD_BLUEPRINT_ID) return;
  addMessage(game, 'Remove framing by tearing down rooms first.', 'info');
}

function undoLastOrder(ctx: HandlerContext): void {
  const { game } = ctx;
  if (game.phase !== 'day') return;
  const last = game.constructionOrders[game.constructionOrders.length - 1];
  if (!last) return;
  cancelConstructionOrder(game, last.id);
}

function cancelAllOrders(ctx: HandlerContext): void {
  const { game } = ctx;
  if (game.phase !== 'day') return;
  const ids = game.constructionOrders.map((o) => o.id);
  for (const id of ids) cancelConstructionOrder(game, id);
}
