import { addMessage } from '@/model/messages';
import { startResearch } from '@/model/research';
import type { HandlerContext } from '../context';
import type { Intent } from '../intents';

export function handleResearchIntent(ctx: HandlerContext, intent: Intent): void {
  switch (intent.type) {
    case 'startResearch': {
      const result = startResearch(ctx.game, intent.nodeId);
      if (!result.ok) {
        addMessage(ctx.game, result.reason, 'info');
      }
      break;
    }
  }
}
