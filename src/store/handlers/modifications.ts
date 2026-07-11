import { canAffordBuild } from '@/calculations/buildCost';
import { addMessage } from '@/model/messages';
import {
  canApplyModification,
  canUpgradeModification,
  getModification,
  modificationCost,
} from '@/model/modifications';
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

function addModificationTo(ctx: HandlerContext, roomId: string, modId: string): void {
  const { game } = ctx;
  if (game.phase !== 'build' || !game.buildBaseline) return;
  const room = game.tower.rooms.find((r) => r.id === roomId);
  const def = getModification(modId);
  if (!room || !def) return;

  if (!canApplyModification(room, game.tower, modId)) {
    addMessage(game, `Cannot add ${def.name} to this room.`, 'info');
    return;
  }
  const cost = modificationCost(def, 1);
  if (!canAffordBuild(game.buildBaseline, game.tower, cost, game.buildRecruitSpend)) {
    addMessage(game, `Not enough gold for ${def.name} (${cost}).`, 'economy');
    return;
  }
  ctx.recordBuildStep();
  room.modifications.push({ id: modId, level: 1 });
  addMessage(game, `Added ${def.name}.`, 'info');
}

function upgradeModificationOn(ctx: HandlerContext, roomId: string, modId: string): void {
  const { game } = ctx;
  if (game.phase !== 'build' || !game.buildBaseline) return;
  const room = game.tower.rooms.find((r) => r.id === roomId);
  const def = getModification(modId);
  const mod = room?.modifications.find((m) => m.id === modId);
  if (!room || !def || !mod) return;

  if (!canUpgradeModification(room, modId)) {
    addMessage(game, `${def.name} is already at max level.`, 'info');
    return;
  }
  const cost = modificationCost(def, mod.level + 1);
  if (!canAffordBuild(game.buildBaseline, game.tower, cost, game.buildRecruitSpend)) {
    addMessage(game, `Not enough gold to upgrade ${def.name} (${cost}).`, 'economy');
    return;
  }
  ctx.recordBuildStep();
  mod.level += 1;
  addMessage(game, `Upgraded ${def.name} to level ${mod.level}.`, 'info');
}
