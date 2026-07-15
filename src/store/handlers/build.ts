import { getBlueprint } from '@/model/blueprints';
import { isInfraBlueprint } from '@/model/infraBlueprints';
import { canAffordBuild } from '@/calculations/buildCost';
import { addMessage } from '@/model/messages';
import { pruneHousingState, pruneOrphanStaffState, seedSpecialtyRoomDefaults } from '@/model/staff';
import { canPlace, createRoom, placeRoomReplacing, removeRoom, roomAt, towersEqual } from '@/model/tower';
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
    case 'undoBuild':
      undoBuild(ctx);
      break;
    case 'revertBuild':
      revertBuild(ctx);
      break;
  }
}

function placeSelected(ctx: HandlerContext, cell: { col: number; row: number }): void {
  const { game, view } = ctx;
  if (game.phase !== 'build' || !game.buildBaseline) return;
  const id = view.selectedBlueprintId;
  if (!id) return;
  if (isInfraBlueprint(id)) return; // handled by infra handler

  const blueprint = getBlueprint(id);
  if (!blueprint) return;

  const result = canPlace(game.tower, blueprint, cell);
  if (!result.ok) {
    addMessage(game, `Cannot build here: ${result.reason.replace(/_/g, ' ')}.`, 'info');
    return;
  }

  const room = createRoom(ctx.nextRoomId(), blueprint, cell);
  const placed = placeRoomReplacing(game.tower, room, blueprint);
  if (!placed.ok || !placed.tower) {
    addMessage(game, `Cannot build here: ${placed.reason.replace(/_/g, ' ')}.`, 'info');
    return;
  }
  if (!canAffordBuild(game.buildBaseline, placed.tower, 0, game.buildRecruitSpend)) {
    addMessage(game, `Not enough gold for ${blueprint.name} (${blueprint.cost}).`, 'economy');
    return;
  }
  ctx.recordBuildStep();
  game.tower = placed.tower;
  seedSpecialtyRoomDefaults(game, room);
  if (view.modal?.kind === 'room') {
    view.modal = null;
  }
  addMessage(game, `Placed ${blueprint.name}.`, 'info');
}

function removeAt(ctx: HandlerContext, cell: { col: number; row: number }): void {
  const room = roomAt(ctx.game.tower, cell.col, cell.row);
  if (room) sellRoomById(ctx, room.id);
}

function sellRoomById(ctx: HandlerContext, roomId: string): void {
  const { game, view } = ctx;
  if (game.phase !== 'build' || !game.buildBaseline) return;
  const room = game.tower.rooms.find((r) => r.id === roomId);
  if (!room) return;

  const blueprint = getBlueprint(room.blueprintId);
  ctx.recordBuildStep();
  game.tower = removeRoom(game.tower, room.id);
  pruneHousingState(game, roomId);
  addMessage(game, `Removed ${blueprint?.name ?? 'room'}.`, 'info');

  if (view.modal?.kind === 'room' && view.modal.roomId === roomId) {
    view.modal = null;
  }
}

function undoBuild(ctx: HandlerContext): void {
  const { game, buildHistory } = ctx;
  if (game.phase !== 'build' || !game.buildBaseline || buildHistory.length === 0) return;

  const snap = buildHistory.pop()!;
  game.tower = snap.tower;
  game.housingRecruited = snap.housingRecruited;
  game.slotAllocations = snap.slotAllocations;
  game.manaSpringAllocations = snap.manaSpringAllocations;
  game.buildRecruitSpend = snap.buildRecruitSpend;
  pruneOrphanStaffState(game);
  ctx.closeModalIfRoomMissing();
  addMessage(game, 'Undid last change.', 'info');
}

function revertBuild(ctx: HandlerContext): void {
  const { game, buildHistory } = ctx;
  const baseline = game.buildBaseline;
  if (game.phase !== 'build' || !baseline) return;

  const layoutChanged = !towersEqual(game.tower, baseline.tower);
  const staffChanged =
    JSON.stringify(game.housingRecruited) !== JSON.stringify(baseline.housingRecruited) ||
    JSON.stringify(game.slotAllocations) !== JSON.stringify(baseline.slotAllocations) ||
    JSON.stringify(game.manaSpringAllocations) !== JSON.stringify(baseline.manaSpringAllocations) ||
    game.buildRecruitSpend !== 0;
  if (!layoutChanged && !staffChanged) return;

  game.tower = structuredClone(baseline.tower);
  game.housingRecruited = structuredClone(baseline.housingRecruited);
  game.slotAllocations = structuredClone(baseline.slotAllocations);
  game.manaSpringAllocations = structuredClone(baseline.manaSpringAllocations);
  game.buildRecruitSpend = 0;
  buildHistory.length = 0;
  pruneOrphanStaffState(game);
  ctx.closeModalIfRoomMissing();
  addMessage(game, 'Reverted to wave start layout.', 'info');
}
