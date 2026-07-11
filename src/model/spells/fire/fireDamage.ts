import { getEnemyTemplate } from '../../enemies';
import { addMessage } from '../../messages';
import type { Enemy } from '../../types';
import type { SpellCastContext } from '../types';
import { KINDLED_BURST } from './constants';
import { clearKindled, isKindled } from './kindled';

/** Normal fire hit, then flat Kindled burst and consume the mark. */
export function applyFireDamage(ctx: SpellCastContext, enemy: Enemy, amount: number, dexterity = 0): void {
  if (enemy.currentHp <= 0) return;

  ctx.damageEnemy(enemy, amount, dexterity);
  if (enemy.currentHp <= 0) return;

  if (!isKindled(enemy, ctx.state)) return;

  const template = getEnemyTemplate(enemy.templateId);
  const typeLabel = template?.type ?? 'foe';
  enemy.currentHp -= KINDLED_BURST;
  clearKindled(enemy);
  addMessage(
    ctx.state,
    `${enemy.name} the ${typeLabel} erupts in a Kindled burst for ${KINDLED_BURST}!`,
    'combat',
  );
}
