import { createBuildOrder } from '@/model/construction';
import {
  getFortificationBlueprint,
  isFortificationBlueprint,
  isFortificationId,
} from '@/model/fortificationBlueprints';
import { removeShellAt, shellKindAt } from '@/model/fortifications/shell';
import { addMessage } from '@/model/messages';
import { isOverhangUnlocked } from '@/model/research';
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
  if (game.phase !== 'day') return;
  const id = view.selectedBlueprintId;
  if (!id || !isFortificationBlueprint(id) || !isFortificationId(id)) return;

  const blueprint = getFortificationBlueprint(id);
  if (!blueprint) return;

  // Same-kind click on a live shell still removes it immediately; new paints queue.
  if (shellKindAt(game.tower, cell.col, cell.row) === id) {
    game.tower = removeShellAt(game.tower, cell.col, cell.row);
    addMessage(game, `Removed ${blueprint.name}.`, 'info');
    return;
  }

  const order = createBuildOrder(game, id, cell, () => ctx.nextRoomId(), {
    overhangUnlocked: isOverhangUnlocked(game),
  });
  if (order && (view.modal?.kind === 'room' || view.modal?.kind === 'structure')) {
    view.modal = null;
  }
}

function sellShellAt(ctx: HandlerContext, col: number, row: number): void {
  const { game, view } = ctx;
  if (game.phase !== 'day') return;
  const kind = game.tower.shell?.[`${col},${row}`]?.kind;
  if (!kind) return;
  const blueprint = getFortificationBlueprint(kind);
  game.tower = removeShellAt(game.tower, col, row);
  addMessage(game, `Removed ${blueprint?.name ?? 'fortification'}.`, 'info');
  if (view.modal?.kind === 'structure') {
    view.modal = null;
  }
}
