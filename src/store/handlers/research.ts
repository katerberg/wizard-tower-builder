import { addMessage } from '@/model/messages';
import {
  cancelActiveResearch,
  dequeueResearch,
  enqueueResearch,
  instantUnlockResearch,
  startResearch,
} from '@/model/research';
import type { HandlerContext } from '../context';
import type { Intent } from '../intents';
import { openResearchModal } from '../viewState';

export function handleResearchIntent(ctx: HandlerContext, intent: Intent): void {
  switch (intent.type) {
    case 'startResearch': {
      const result = startResearch(ctx.game, intent.nodeId);
      if (!result.ok) {
        addMessage(ctx.game, result.reason, 'info');
      } else {
        ctx.view.selectedResearchNodeId = intent.nodeId;
      }
      break;
    }
    case 'enqueueResearch': {
      const result = enqueueResearch(ctx.game, intent.nodeId);
      if (!result.ok) {
        addMessage(ctx.game, result.reason, 'info');
      }
      break;
    }
    case 'dequeueResearch': {
      const result = dequeueResearch(ctx.game, intent.nodeId);
      if (!result.ok) {
        addMessage(ctx.game, result.reason, 'info');
      }
      break;
    }
    case 'cancelResearch': {
      const result = cancelActiveResearch(ctx.game);
      if (!result.ok) {
        addMessage(ctx.game, result.reason, 'info');
      }
      break;
    }
    case 'openResearchModal':
      openResearchModal(ctx.view, ctx.game);
      break;
    case 'selectResearchNode':
      ctx.view.selectedResearchNodeId = intent.nodeId;
      break;
    case 'toggleResearchGroup': {
      const id = intent.groupId;
      const set = new Set(ctx.view.researchExpandedGroupIds);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      ctx.view.researchExpandedGroupIds = [...set];
      break;
    }
    case 'devUnlockResearch': {
      if (!ctx.game.devMode) return;
      const result = instantUnlockResearch(ctx.game, intent.nodeId);
      if (!result.ok) {
        addMessage(ctx.game, result.reason, 'info');
      }
      break;
    }
  }
}
