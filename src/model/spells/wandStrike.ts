import { macroDistance } from '@/calculations/subGrid';
import { WIZARD_DEFAULTS } from '@/config/constants';
import { getWizardPosition } from '../tower';
import type { SpellDef } from './types';

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
      const d = macroDistance(enemy.pos, wizardPos);
      if (d <= wandStrike.range && d < bestDist) {
        bestDist = d;
        target = enemy;
      }
    }
    if (!target) return;
    ctx.damageEnemy(target, wandStrike.damage, wandStrike.dexterity);
  },
};
