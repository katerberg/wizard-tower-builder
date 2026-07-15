import { addMessage } from '@/model/messages';
import {
  canCastSpell,
  castSpell,
  clearFortify,
  enemyAtCell,
  getSpell,
  isFortified,
} from '@/model/spells';
import type { HandlerContext } from '../context';
import type { Intent } from '../intents';

export function handleSpellIntent(ctx: HandlerContext, intent: Intent): void {
  switch (intent.type) {
    case 'selectSpell':
      if (ctx.game.phase === 'attack') {
        ctx.view.selectedSpellId = intent.spellId;
        ctx.view.castAnchor = null;
      }
      break;
    case 'cancelCast':
      ctx.view.selectedSpellId = null;
      ctx.view.castAnchor = null;
      if (isFortified(ctx.game)) {
        clearFortify(ctx.game, 'Fortify cancelled.');
      }
      break;
    case 'castSpellAt':
      handleCastAt(ctx, intent.spellId, intent.cell);
      break;
  }
}

function handleCastAt(ctx: HandlerContext, spellId: string, cell: { col: number; row: number }): void {
  const spell = getSpell(spellId);
  if (!spell) return;

  if (spell.targeting === 'self') {
    const result = castSpell(ctx.game, spellId, { kind: 'self' });
    if (!result.ok) {
      addMessage(ctx.game, `Cannot cast: ${result.reason.replace(/_/g, ' ')}.`, 'info');
    } else {
      ctx.view.selectedSpellId = null;
      ctx.view.castAnchor = null;
    }
    return;
  }

  if (spell.targeting === 'segment' || spell.targeting === 'airSegment') {
    if (!ctx.view.castAnchor) {
      const check = canCastSpell(ctx.game, spellId, { kind: 'cell', cell });
      if (!check.ok) {
        addMessage(ctx.game, `Cannot cast: ${check.reason.replace(/_/g, ' ')}.`, 'info');
        return;
      }
      ctx.view.castAnchor = cell;
      return;
    }

    const result = castSpell(ctx.game, spellId, {
      kind: 'segment',
      from: ctx.view.castAnchor,
      to: cell,
    });
    if (!result.ok) {
      addMessage(ctx.game, `Cannot cast: ${result.reason.replace(/_/g, ' ')}.`, 'info');
      return;
    }
    ctx.view.selectedSpellId = null;
    ctx.view.castAnchor = null;
    return;
  }

  let target;
  if (spell.targeting === 'enemy') {
    const enemy = enemyAtCell(ctx.game, cell);
    if (!enemy) {
      addMessage(ctx.game, 'Cannot cast: no target.', 'info');
      return;
    }
    target = { kind: 'enemy' as const, enemyId: enemy.id };
  } else {
    target = { kind: 'cell' as const, cell };
  }

  const result = castSpell(ctx.game, spellId, target);
  if (!result.ok) {
    addMessage(ctx.game, `Cannot cast: ${result.reason.replace(/_/g, ' ')}.`, 'info');
  } else {
    ctx.view.selectedSpellId = null;
    ctx.view.castAnchor = null;
  }
}

export function clearSelectedSpell(ctx: HandlerContext): void {
  ctx.view.selectedSpellId = null;
  ctx.view.castAnchor = null;
}
