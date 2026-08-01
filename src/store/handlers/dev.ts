import { reward } from '@/calculations/economy';
import { addResources } from '@/calculations/resources';
import { addMessage } from '@/model/messages';
import { setActiveSpellSchool } from '@/model/spells';
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
        const grant = { gold: 50, metal: 50, stone: 50, souls: 50 };
        reward(ctx.game, grant);
        if (ctx.game.buildBaseline) {
          ctx.game.buildBaseline.resources = addResources(ctx.game.buildBaseline.resources, grant);
        }
        addMessage(ctx.game, 'Dev: +50 to each resource.', 'economy');
      }
      break;
    case 'devSkipWave':
      if (ctx.game.devMode && ctx.game.phase === 'attack') {
        ctx.game.enemies = [];
        ctx.game.spawnQueue = [];
        addMessage(ctx.game, 'Dev: wave skipped.', 'info');
      }
      break;
    case 'devSetSpellSchool':
      if (ctx.game.devMode) {
        setActiveSpellSchool(ctx.game, intent.school);
        addMessage(ctx.game, `Dev: spell school set to ${intent.school}.`, 'info');
      }
      break;
  }
}
