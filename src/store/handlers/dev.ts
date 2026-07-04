import { reward } from '@/calculations/economy';
import { addMessage } from '@/model/messages';
import type { HandlerContext } from '../context';
import type { Intent } from '../intents';

export function handleDevIntent(ctx: HandlerContext, intent: Intent): void {
  switch (intent.type) {
    case 'toggleDevMode':
      ctx.game.devMode = !ctx.game.devMode;
      addMessage(ctx.game, `Dev mode ${ctx.game.devMode ? 'on' : 'off'}.`, 'info');
      break;
    case 'devAddCurrency':
      if (ctx.game.devMode) {
        reward(ctx.game, 50);
        if (ctx.game.buildBaseline) ctx.game.buildBaseline.currency += 50;
        addMessage(ctx.game, 'Dev: +50 gold.', 'economy');
      }
      break;
    case 'devSkipWave':
      if (ctx.game.devMode && ctx.game.phase === 'attack') {
        ctx.game.enemies = [];
        ctx.game.spawnQueue = [];
        addMessage(ctx.game, 'Dev: wave skipped.', 'info');
      }
      break;
  }
}
