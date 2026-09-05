import { createBuildOrder } from '@/model/construction';
import { getInfraBlueprint, isInfraBlueprint } from '@/model/infraBlueprints';
import { getInfraAt, removeInfraAt } from '@/model/infra';
import { reconcileAutoStairs } from '@/model/autoStairs';
import { addMessage } from '@/model/messages';
import { isOverhangUnlocked } from '@/model/research';
import { roomAt } from '@/model/tower';
import type { HandlerContext } from '../context';
import type { Intent } from '../intents';

export function handleInfraIntent(ctx: HandlerContext, intent: Intent): void {
  switch (intent.type) {
    case 'placeSelectedAt':
      placeInfraSelected(ctx, intent.cell);
      break;
    case 'removeRoomAt':
      removeInfraAtCell(ctx, intent.cell);
      break;
    case 'removeInfraAt':
      removeInfraAtCell(ctx, intent.cell);
      break;
  }
}

function placeInfraSelected(ctx: HandlerContext, cell: { col: number; row: number }): void {
  const { game, view } = ctx;
  if (game.phase !== 'day') return;
  const id = view.selectedBlueprintId;
  if (!id || !isInfraBlueprint(id)) return;

  const blueprint = getInfraBlueprint(id);
  if (!blueprint?.infraKind) return;
  if (blueprint.infraKind === 'stair') {
    addMessage(game, 'Stairs are placed automatically.', 'info');
    return;
  }

  // Same-kind click on live infra still removes it immediately; new paints queue.
  if (getInfraAt(game.tower, cell.col, cell.row)?.kind === blueprint.infraKind) {
    let next = removeInfraAt(game.tower, cell.col, cell.row);
    if ((next.rooms?.length ?? 0) > 0) {
      const stairs = reconcileAutoStairs(next);
      if (!stairs.ok) {
        addMessage(game, 'Cannot change layout: would disconnect rooms from ground.', 'info');
        return;
      }
      next = stairs.tower;
    }
    game.tower = next;
    addMessage(game, `Removed ${blueprint.name}.`, 'info');
    return;
  }

  createBuildOrder(game, id, cell, () => ctx.nextRoomId(), {
    overhangUnlocked: isOverhangUnlocked(game),
  });
}

function removeInfraAtCell(ctx: HandlerContext, cell: { col: number; row: number }): void {
  const { game } = ctx;
  if (game.phase !== 'day') return;
  if (roomAt(game.tower, cell.col, cell.row)) return;
  const existing = getInfraAt(game.tower, cell.col, cell.row);
  if (!existing) return;
  if (existing.kind === 'stair') return;

  let next = removeInfraAt(game.tower, cell.col, cell.row);
  if ((next.rooms?.length ?? 0) > 0) {
    const stairs = reconcileAutoStairs(next);
    if (!stairs.ok) {
      addMessage(game, 'Cannot change layout: would disconnect rooms from ground.', 'info');
      return;
    }
    next = stairs.tower;
  }
  game.tower = next;
  addMessage(game, 'Removed infrastructure.', 'info');
}
