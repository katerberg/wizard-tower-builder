import { canAffordPhysical, stockpileFromCost, findStorageForReservation, reserveStorage, consumeReservation } from '@/model/storage';
import { spend } from '@/calculations/economy';
import { formatResourceCost } from '@/calculations/resources';
import {
  getFortificationBlueprint,
  isFortificationBlueprint,
  isFortificationId,
} from '@/model/fortificationBlueprints';
import { removeShellAt } from '@/model/fortifications/shell';
import {
  applyFortificationPlacement,
  planFortificationPlacement,
} from '@/model/fortificationPlacement';
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

function spendPhysicalCost(ctx: HandlerContext, cell: { col: number; row: number }, cost: import('@/model/types').ResourceCost): boolean {
  const { game } = ctx;
  if (!canAffordPhysical(game, cost)) return false;
  const physical = stockpileFromCost(cost);
  const storageId = findStorageForReservation(game, physical, cell);
  if (!storageId && (physical.stone > 0 || physical.metal > 0)) return false;
  const orderId = `fort-spend-${Date.now()}`;
  if (storageId) {
    reserveStorage(game, orderId, storageId, physical);
    consumeReservation(game, orderId);
  }
  if (cost.souls) spend(game, { souls: cost.souls });
  if (cost.gold) spend(game, { gold: cost.gold });
  return true;
}

function placeFortificationSelected(ctx: HandlerContext, cell: { col: number; row: number }): void {
  const { game, view } = ctx;
  if (game.phase !== 'day') return;
  const id = view.selectedBlueprintId;
  if (!id || !isFortificationBlueprint(id) || !isFortificationId(id)) return;

  const blueprint = getFortificationBlueprint(id);
  if (!blueprint) return;

  const plan = planFortificationPlacement(game.tower, id, cell);
  if (plan.isToggleOff) {
    game.tower = removeShellAt(game.tower, cell.col, cell.row);
    addMessage(game, `Removed ${blueprint.name}.`, 'info');
    return;
  }

  if (!plan.ok) {
    addMessage(game, `Cannot build here: ${plan.reason.replace(/_/g, ' ')}.`, 'info');
    return;
  }

  if (!spendPhysicalCost(ctx, cell, blueprint.cost)) {
    addMessage(
      game,
      `Not enough resources for ${blueprint.name} (${formatResourceCost(blueprint.cost)}).`,
      'economy',
    );
    return;
  }

  game.tower = applyFortificationPlacement(game.tower, id, cell, ctx.nextRoomId(), plan);
  if (view.modal?.kind === 'room' || view.modal?.kind === 'structure') {
    view.modal = null;
  }
  if (plan.needsStem) {
    addMessage(game, `Placed Spire Block and ${blueprint.name}.`, 'info');
  } else {
    addMessage(game, `Placed ${blueprint.name}.`, 'info');
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
