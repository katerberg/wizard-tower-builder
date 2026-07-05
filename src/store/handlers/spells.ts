import { addMessage } from '@/model/messages';
import { castSpell } from '@/model/spells';
import type { HandlerContext } from '../context';
import type { Intent } from '../intents';

export function handleSpellIntent(ctx: HandlerContext, intent: Intent): void {
  switch (intent.type) {
    case 'selectSpell':
      if (ctx.game.phase === 'attack') {
        ctx.view.selectedSpellId = intent.spellId;
      }
      break;
    case 'cancelCast':
      ctx.view.selectedSpellId = null;
      break;
    case 'castSpellAt': {
      const result = castSpell(ctx.game, intent.spellId, { kind: 'cell', cell: intent.cell });
      if (!result.ok) {
        const reason = result.reason.replace(/_/g, ' ');
        addMessage(ctx.game, `Cannot cast: ${reason}.`, 'info');
      } else {
        ctx.view.selectedSpellId = null;
      }
      break;
    }
  }
}

export function clearSelectedSpell(ctx: HandlerContext): void {
  ctx.view.selectedSpellId = null;
}
