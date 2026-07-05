import { WIZARD_DEFAULTS } from '@/config/constants';
import { getWizardPosition } from '../tower';
import type { SpellDef } from './types';

function distance(a: { col: number; row: number }, b: { col: number; row: number }): number {
  return Math.hypot(a.col - b.col, a.row - b.row);
}

export const wandStrike: SpellDef = {
  id: 'wandStrike',
  name: 'Wand Strike',
  glyph: '·',
  description: 'Auto-zaps the nearest climber in range.',
  manaCost: 0,
  cooldown: WIZARD_DEFAULTS.attackCooldown,
  targeting: 'autoNearest',
  range: WIZARD_DEFAULTS.range,
  damage: WIZARD_DEFAULTS.attack,
  dexterity: WIZARD_DEFAULTS.dexterity,
  autoCast: true,
  cast(ctx) {
    const wizardPos = getWizardPosition(ctx.state.tower);
    let target = null;
    let bestDist = Infinity;
    for (const enemy of ctx.state.enemies) {
      if (enemy.currentHp <= 0) continue;
      const d = distance(enemy.pos, wizardPos);
      if (d <= wandStrike.range && d < bestDist) {
        bestDist = d;
        target = enemy;
      }
    }
    if (!target) return;
    ctx.damageEnemy(target, wandStrike.damage, wandStrike.dexterity);
  },
};
