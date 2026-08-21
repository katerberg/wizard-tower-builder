import { canAffordPhysical, stockpileFromCost, findStorageForReservation, reserveStorage, consumeReservation } from '@/model/storage';
import { spend } from '@/calculations/economy';
import { formatResourceCost } from '@/calculations/resources';
import { getInfraBlueprint, isInfraBlueprint } from '@/model/infraBlueprints';
import { getInfraAt, removeInfraAt } from '@/model/infra';
import { applyInfraPlacement, planInfraPlacement } from '@/model/infraPlacement';
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

function spendPhysicalCost(ctx: HandlerContext, cell: { col: number; row: number }, cost: import('@/model/types').ResourceCost): boolean {
  const { game } = ctx;
  const physical = stockpileFromCost(cost);
  if (!canAffordPhysical(game, cost)) {
    return false;
  }
  const storageId = findStorageForReservation(game, physical, cell);
  if (!storageId && (physical.stone > 0 || physical.metal > 0)) return false;
  const orderId = `infra-spend-${Date.now()}`;
  if (storageId) {
    reserveStorage(game, orderId, storageId, physical);
    consumeReservation(game, orderId);
  }
  if (cost.souls) spend(game, { souls: cost.souls });
  if (cost.gold) spend(game, { gold: cost.gold });
  return true;
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

  const placementOptions = { overhangUnlocked: isOverhangUnlocked(game) };
  const plan = planInfraPlacement(game.tower, blueprint, cell, placementOptions);
  if (plan.isToggleOff) {
    let next = removeInfraAt(game.tower, cell.col, cell.row);
    if ((next.rooms?.length ?? 0) > 0) {
      const stairs = reconcileAutoStairs(next);
      if (!stairs.ok) {
        console.warn(`Auto-stairs: cannot remove infra at ${cell.col},${cell.row}: ${stairs.reason}`);
        addMessage(game, 'Cannot change layout: would disconnect rooms from ground.', 'info');
        return;
      }
      next = stairs.tower;
    }
    game.tower = next;
    addMessage(game, `Removed ${blueprint.name}.`, 'info');
    return;
  }

  if (!plan.ok) {
    if (plan.reason === 'fluid_mix') {
      addMessage(game, 'Would mix pipe fluids.', 'info');
    } else if (plan.reason === 'boiler_footprint') {
      addMessage(game, 'Cannot place pipes on a boiler.', 'info');
    } else {
      addMessage(game, `Cannot build here: ${plan.reason.replace(/_/g, ' ')}.`, 'info');
    }
    return;
  }

  if (!spendPhysicalCost(ctx, cell, blueprint.cost)) {
    addMessage(game, `Not enough resources for ${blueprint.name} (${formatResourceCost(blueprint.cost)}).`, 'economy');
    return;
  }

  let next = applyInfraPlacement(game.tower, blueprint, cell, ctx.nextRoomId(), plan);
  if ((next.rooms?.length ?? 0) > 0) {
    const stairs = reconcileAutoStairs(next);
    if (!stairs.ok) {
      console.warn(`Auto-stairs: cannot place ${blueprint.name} at ${cell.col},${cell.row}: ${stairs.reason}`);
      addMessage(game, 'Cannot change layout: would disconnect rooms from ground.', 'info');
      return;
    }
    next = stairs.tower;
  }
  game.tower = next;
  if (plan.needsStem) {
    addMessage(game, `Placed Spire Block and ${blueprint.name}.`, 'info');
  } else {
    addMessage(game, `Placed ${blueprint.name}.`, 'info');
  }
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
      console.warn(`Auto-stairs: cannot remove infra at ${cell.col},${cell.row}: ${stairs.reason}`);
      addMessage(game, 'Cannot change layout: would disconnect rooms from ground.', 'info');
      return;
    }
    next = stairs.tower;
  }
  game.tower = next;
  addMessage(game, 'Removed infrastructure.', 'info');
}
