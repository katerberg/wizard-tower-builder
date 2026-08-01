import { SUB_CELL_SIZE } from '@/config/constants';
import { colors } from '@/view/theme';
import { sameMacroCell } from '@/calculations/subGrid';
import { getEnemyTemplate } from '@/model/enemies';
import type { ExteriorFace } from '@/model/types';
import type { Snapshot } from '@/store/store';
import { enemyDrawRadius, exteriorNodeDrawCenter } from '../camera';
import { drawHpBar } from './shared';

export function drawEnemies(
  ctx: CanvasRenderingContext2D,
  snapshot: Snapshot,
  wizardPos: { col: number; row: number },
  scrollY: number,
  viewportHeight: number,
  layer: 'climbers' | 'atWizard',
): void {
  for (const enemy of snapshot.game.enemies) {
    const atWizard = sameMacroCell(enemy.pos, wizardPos);
    if (layer === 'climbers' ? atWizard : !atWizard) continue;
    const template = getEnemyTemplate(enemy.templateId);
    const pos = interpolatedEnemyPos(enemy, snapshot);
    const tier = template?.sizeTier ?? 'small';
    const r = enemyDrawRadius(tier);
    let x: number; let y: number;
    if (atWizard) {
      const draw = exteriorNodeDrawCenter(pos, scrollY, viewportHeight, r);
      x = draw.x + (enemy.id.charCodeAt(enemy.id.length - 1) % 2 === 0 ? 1 : -1) * SUB_CELL_SIZE * 0.55;
      y = draw.y;
    } else ({ x, y } = exteriorNodeDrawCenter(pos, scrollY, viewportHeight, r));
    if (y + r < 0 || y - r > viewportHeight) continue;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = template?.color ?? colors.enemy; ctx.fill();
    ctx.fillStyle = '#1a202c'; ctx.font = `${Math.floor(r * 1.2)}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(template?.glyph ?? 'e', x, y);
    if (template && tier !== 'small') drawHpBar(ctx, x - r, y - r - 6, r * 2, enemy.currentHp / template.stats.maxHp);
  }
}

function interpolatedEnemyPos(enemy: { id: string; pos: { col: number; row: number; face: ExteriorFace } }, snapshot: Snapshot): { col: number; row: number; face: ExteriorFace } {
  const prev = snapshot.previousEnemyPositions.get(enemy.id);
  if (!prev || snapshot.renderAlpha >= 1) return enemy.pos;
  return { col: prev.col + (enemy.pos.col - prev.col) * snapshot.renderAlpha, row: prev.row + (enemy.pos.row - prev.row) * snapshot.renderAlpha, face: enemy.pos.face };
}
