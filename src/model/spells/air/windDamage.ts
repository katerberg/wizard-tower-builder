import { getEnemyTemplate } from '../../enemies';
import { addMessage } from '../../messages';
import type { Enemy } from '../../types';
import type { SpellCastContext } from '../types';

/** Light wind chip — separate from fire/Kindled. */
export function applyWindDamage(ctx: SpellCastContext, enemy: Enemy, amount: number): void {
  if (enemy.currentHp <= 0) return;
  const template = getEnemyTemplate(enemy.templateId);
  if (!template) return;
  enemy.currentHp -= amount;
  addMessage(
    ctx.state,
    `${ctx.spellName} buffets ${enemy.name} the ${template.type} for ${amount}.`,
    'combat',
  );
}
