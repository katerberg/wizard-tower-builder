import { clampScrollY } from '@/calculations/camera';
import type { HandlerContext } from '../context';
import type { Intent } from '../intents';

export function handleCameraIntent(ctx: HandlerContext, intent: Intent): void {
  switch (intent.type) {
    case 'scrollCamera':
      ctx.view.cameraScrollY = clampScrollY(
        ctx.view.cameraScrollY - intent.deltaY,
        ctx.game.tower,
        ctx.view.viewportHeight,
      );
      break;
    case 'setViewportHeight':
      if (intent.height === ctx.view.viewportHeight) break;
      ctx.view.viewportHeight = intent.height;
      ctx.view.cameraScrollY = clampScrollY(ctx.view.cameraScrollY, ctx.game.tower, intent.height);
      break;
  }
}
