import { addMessage } from '@/model/messages';
import { castSpell, getSpell } from '@/model/spells';
import type { HandlerContext } from '../context';
import type { Intent } from '../intents';

export function handleSpellIntent(ctx: HandlerContext, intent: Intent): void {
  switch (intent.type) {
    case 'selectSpell':
      if (ctx.game.phase === 'attack') {
        ctx.view.selectedSpellId = intent.spellId;
        ctx.view.wallOfFlameAnchor = null;
      }
      break;
    case 'cancelCast':
      ctx.view.selectedSpellId = null;
      ctx.view.wallOfFlameAnchor = null;
      break;
    case 'castSpellOnEnemy': {
      const result = castSpell(ctx.game, intent.spellId, {
        kind: 'enemy',
        enemyId: intent.enemyId,
      });
      if (!result.ok) {
        const reason = result.reason.replace(/_/g, ' ');
        addMessage(ctx.game, `Cannot cast: ${reason}.`, 'info');
      } else {
        ctx.view.selectedSpellId = null;
        ctx.view.wallOfFlameAnchor = null;
      }
      break;
    }
    case 'castSpellAt': {
      const spell = getSpell(intent.spellId);
      if (!spell) break;

      if (spell.targeting === 'wallSegment') {
        if (!ctx.view.wallOfFlameAnchor) {
          ctx.view.wallOfFlameAnchor = intent.cell;
          addMessage(ctx.game, 'Wall of Flame: pick end point.', 'info');
          break;
        }
        const result = castSpell(ctx.game, intent.spellId, {
          kind: 'segment',
          a: ctx.view.wallOfFlameAnchor,
          b: intent.cell,
        });
        ctx.view.wallOfFlameAnchor = null;
        if (!result.ok) {
          const reason = result.reason.replace(/_/g, ' ');
          addMessage(ctx.game, `Cannot cast: ${reason}.`, 'info');
        } else {
          ctx.view.selectedSpellId = null;
        }
        break;
      }

      const result = castSpell(ctx.game, intent.spellId, { kind: 'cell', cell: intent.cell });
      if (!result.ok) {
        const reason = result.reason.replace(/_/g, ' ');
        addMessage(ctx.game, `Cannot cast: ${reason}.`, 'info');
      } else {
        ctx.view.selectedSpellId = null;
        ctx.view.wallOfFlameAnchor = null;
      }
      break;
    }
  }
}

export function clearSelectedSpell(ctx: HandlerContext): void {
  ctx.view.selectedSpellId = null;
  ctx.view.wallOfFlameAnchor = null;
}
