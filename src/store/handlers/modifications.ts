import {
  canAffordPhysical,
  stockpileFromCost,
  findStorageForReservation,
  reserveStorage,
  consumeReservation,
} from '@/model/storage';
import { spend } from '@/calculations/economy';
import { formatResourceCost, canAffordResources } from '@/calculations/resources';
import { MOD_SIDE_JOB_SEC } from '@/config/dayNight';
import { addMessage } from '@/model/messages';
import { enqueueSideJob } from '@/model/sideJobs';
import {
  canApplyModification,
  canUpgradeModification,
  getModification,
  modificationCost,
} from '@/model/modifications';
import type { GameState } from '@/model/types';
import type { HandlerContext } from '../context';
import type { Intent } from '../intents';

export function handleModificationsIntent(ctx: HandlerContext, intent: Intent): void {
  switch (intent.type) {
    case 'addModification':
      addModificationTo(ctx, intent.roomId, intent.modId);
      break;
    case 'upgradeModification':
      upgradeModificationOn(ctx, intent.roomId, intent.modId);
      break;
  }
}

function spendModCost(ctx: HandlerContext, cost: import('@/model/types').ResourceCost): boolean {
  const { game } = ctx;
  const physical = stockpileFromCost(cost);
  const walletOk =
    canAffordResources(game.player.resources, {
      gold: cost.gold ?? 0,
      souls: cost.souls ?? 0,
      stone: 0,
      metal: 0,
    }) && canAffordPhysical(game, cost);
  if (!walletOk) return false;
  if (cost.souls || cost.gold) spend(game, { souls: cost.souls, gold: cost.gold });
  if (physical.stone > 0 || physical.metal > 0) {
    const storageId = findStorageForReservation(game, physical, { col: 7, row: 0 });
    if (!storageId) return false;
    const orderId = `mod-spend-${Date.now()}`;
    reserveStorage(game, orderId, storageId, physical);
    consumeReservation(game, orderId);
  }
  return true;
}

function addModificationTo(ctx: HandlerContext, roomId: string, modId: string): void {
  const { game } = ctx;
  if (game.phase !== 'day') return;
  const room = game.tower.rooms.find((r) => r.id === roomId);
  const def = getModification(modId);
  if (!room || !def) return;

  if (!canApplyModification(room, game.tower, modId)) {
    addMessage(game, `Cannot add ${def.name} to this room.`, 'info');
    return;
  }
  if (!game.player.unlockedModifications.includes(modId)) {
    addMessage(game, `${def.name} is locked — research it first.`, 'info');
    return;
  }
  const cost = modificationCost(def, 1);
  if (!spendModCost(ctx, cost)) {
    addMessage(game, `Not enough resources for ${def.name} (${formatResourceCost(cost)}).`, 'economy');
    return;
  }

  enqueueSideJob(game, 'applyMod', `Adding ${def.name}`, MOD_SIDE_JOB_SEC, {
    roomId,
    modId,
    onComplete: (state: GameState, payload: Record<string, unknown>) => {
      const roomId = payload.roomId as string;
      const modId = payload.modId as string;
      const r = state.tower.rooms.find((x) => x.id === roomId);
      const d = getModification(modId);
      if (r && d) {
        r.modifications.push({ id: modId, level: 1 });
        addMessage(state, `Added ${d.name}.`, 'info');
      }
    },
  });
}

function upgradeModificationOn(ctx: HandlerContext, roomId: string, modId: string): void {
  const { game } = ctx;
  if (game.phase !== 'day') return;
  const room = game.tower.rooms.find((r) => r.id === roomId);
  const def = getModification(modId);
  const mod = room?.modifications.find((m) => m.id === modId);
  if (!room || !def || !mod) return;

  if (!canUpgradeModification(room, modId)) {
    addMessage(game, `${def.name} is already at max level.`, 'info');
    return;
  }
  const cost = modificationCost(def, mod.level + 1);
  if (!spendModCost(ctx, cost)) {
    addMessage(game, `Not enough resources to upgrade ${def.name} (${formatResourceCost(cost)}).`, 'economy');
    return;
  }

  enqueueSideJob(game, 'applyMod', `Upgrading ${def.name}`, MOD_SIDE_JOB_SEC, {
    roomId,
    modId,
    onComplete: (state: GameState, payload: Record<string, unknown>) => {
      const roomId = payload.roomId as string;
      const modId = payload.modId as string;
      const r = state.tower.rooms.find((x) => x.id === roomId);
      const m = r?.modifications.find((x) => x.id === modId);
      const d = getModification(modId);
      if (m && d) {
        m.level += 1;
        addMessage(state, `Upgraded ${d.name} to level ${m.level}.`, 'info');
      }
    },
  });
}
