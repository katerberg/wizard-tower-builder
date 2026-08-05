import { canAffordBuild } from '@/calculations/buildCost';
import { formatResourceCost } from '@/calculations/resources';
import {
  getFortificationBlueprint,
  isFortificationBlueprint,
  isFortificationId,
} from '@/model/fortificationBlueprints';
import { planFortificationPlacement, placeShell, removeShellAt } from '@/model/fortifications/shell';
import { addMessage } from '@/model/messages';
import type { HandlerContext } from '../context';
import type { Intent } from '../intents';

export function handleFortificationIntent(ctx: HandlerContext, intent: Intent): void {
  switch (intent.type) {
    case 'placeSelectedAt':
      placeFortificationSelected(ctx, intent.cell);
      break;
    case 'sellShell':
      sellShellAt(ctx, intent.col, intent.row);
      break;
  }
}

function placeFortificationSelected(ctx: HandlerContext, cell: { col: number; row: number }): void {
  const { game, view } = ctx;
  if (game.phase !== 'build' || !game.buildBaseline) return;
  const id = view.selectedBlueprintId;
  if (!id || !isFortificationBlueprint(id) || !isFortificationId(id)) return;

  const blueprint = getFortificationBlueprint(id);
  if (!blueprint) return;

  const plan = planFortificationPlacement(game.tower, id, cell);
  if (plan.isToggleOff) {
    ctx.recordBuildStep();
    game.tower = removeShellAt(game.tower, cell.col, cell.row);
    addMessage(game, `Removed ${blueprint.name}.`, 'info');
    return;
  }

  if (!plan.ok) {
    addMessage(game, `Cannot build here: ${plan.reason.replace(/_/g, ' ')}.`, 'info');
    return;
  }

  const nextTower = placeShell(game.tower, cell, id);
  if (!canAffordBuild(game.buildBaseline, nextTower, {}, game.buildRecruitSpend)) {
    addMessage(
      game,
      `Not enough resources for ${blueprint.name} (${formatResourceCost(blueprint.cost)}).`,
      'economy',
    );
    return;
  }

  ctx.recordBuildStep();
  game.tower = nextTower;
  if (view.modal?.kind === 'room' || view.modal?.kind === 'structure') {
    view.modal = null;
  }
  addMessage(game, `Placed ${blueprint.name}.`, 'info');
}

function sellShellAt(ctx: HandlerContext, col: number, row: number): void {
  const { game, view } = ctx;
  if (game.phase !== 'build' || !game.buildBaseline) return;
  const kind = game.tower.shell?.[`${col},${row}`]?.kind;
  if (!kind) return;
  const blueprint = getFortificationBlueprint(kind);
  ctx.recordBuildStep();
  game.tower = removeShellAt(game.tower, col, row);
  addMessage(game, `Removed ${blueprint?.name ?? 'fortification'}.`, 'info');
  if (view.modal?.kind === 'structure') {
    view.modal = null;
  }
}
