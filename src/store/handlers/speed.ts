import type { SimSpeed } from '@/model/types';
import type { HandlerContext } from '../context';
import type { Intent } from '../intents';

export function handleSpeedIntent(ctx: HandlerContext, intent: Intent): void {
  if (intent.type !== 'setSimSpeed') return;
  const speed: SimSpeed = intent.speed;
  // Research modal owns the pause; remember the chosen speed for close, keep sim at 0.
  if (ctx.view.modal?.kind === 'research') {
    ctx.view.researchResumeSimSpeed = speed;
    ctx.game.simSpeed = 0;
    return;
  }
  ctx.game.simSpeed = speed;
}
