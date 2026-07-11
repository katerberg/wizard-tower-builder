import { persistSimSpeed } from '@/model/game';
import type { SimSpeed } from '@/model/types';
import type { HandlerContext } from '../context';
import type { Intent } from '../intents';

export function handleSpeedIntent(ctx: HandlerContext, intent: Intent): void {
  if (intent.type !== 'setSimSpeed') return;
  const speed: SimSpeed = intent.speed;
  ctx.game.simSpeed = speed;
  persistSimSpeed(speed);
}
