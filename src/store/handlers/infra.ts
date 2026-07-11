import { canAffordBuild } from '@/calculations/buildCost';
import { getInfraBlueprint, isInfraBlueprint } from '@/model/infraBlueprints';
import { canPlaceInfra, getInfraAt, placeInfra, removeInfraAt } from '@/model/infra';
import { addMessage } from '@/model/messages';
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
  if (game.phase !== 'build' || !game.buildBaseline) return;
  const id = view.selectedBlueprintId;
  if (!id || !isInfraBlueprint(id)) return;

  const blueprint = getInfraBlueprint(id);
  if (!blueprint?.infraKind) return;

  const existing = getInfraAt(game.tower, cell.col, cell.row);
  if (existing?.kind === blueprint.infraKind) {
    ctx.recordBuildStep();
    game.tower = removeInfraAt(game.tower, cell.col, cell.row);
    addMessage(game, `Removed ${blueprint.name}.`, 'info');
    return;
  }

  if (!canPlaceInfra(game.tower, blueprint, cell)) {
    addMessage(game, 'Cannot place infra here (cell occupied by other infra).', 'info');
    return;
  }

  const nextTower = placeInfra(game.tower, cell, blueprint.infraKind);
  if (!canAffordBuild(game.buildBaseline, nextTower, 0, game.buildRecruitSpend)) {
    addMessage(game, `Not enough gold for ${blueprint.name} (${blueprint.cost}).`, 'economy');
    return;
  }

  ctx.recordBuildStep();
  game.tower = nextTower;
  addMessage(game, `Placed ${blueprint.name}.`, 'info');
}

function removeInfraAtCell(ctx: HandlerContext, cell: { col: number; row: number }): void {
  const { game } = ctx;
  if (game.phase !== 'build' || !game.buildBaseline) return;
  if (roomAt(game.tower, cell.col, cell.row)) return;
  if (!getInfraAt(game.tower, cell.col, cell.row)) return;

  ctx.recordBuildStep();
  game.tower = removeInfraAt(game.tower, cell.col, cell.row);
  addMessage(game, 'Removed infrastructure.', 'info');
}
