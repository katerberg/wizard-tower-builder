import { setWizardDestination } from '@/model/wizard';
import type { HandlerContext } from '../context';
import type { Intent } from '../intents';

export function handleWizardIntent(ctx: HandlerContext, intent: Intent): void {
  if (intent.type !== 'moveWizard') return;
  if (ctx.game.scene !== 'run' || ctx.game.phase !== 'night') return;
  setWizardDestination(ctx.game, intent.cell);
}
