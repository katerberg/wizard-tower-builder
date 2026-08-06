import { SUB_CELL_SIZE } from '@/config/constants';
import { colors } from '@/view/theme';
import { sameMacroCell } from '@/calculations/subGrid';
import { getEnemyTemplate } from '@/model/enemies';
import {
  getSoak,
  isDiscombobulated,
  isImmolating,
  isKindled,
} from '@/model/spells';
import type { Enemy, ExteriorFace, GameState } from '@/model/types';
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
    drawSoakTint(ctx, enemy, x, y, r);
    ctx.fillStyle = '#1a202c'; ctx.font = `${Math.floor(r * 1.2)}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(template?.glyph ?? 'e', x, y);
    drawStatusRings(ctx, enemy, snapshot.game, x, y, r);
    drawStatusBadges(ctx, enemy, snapshot.game, x, y, r);
    if (template && tier !== 'small') drawHpBar(ctx, x - r, y - r - 6, r * 2, enemy.currentHp / template.stats.maxHp);
  }
}

function drawSoakTint(
  ctx: CanvasRenderingContext2D,
  enemy: Enemy,
  x: number,
  y: number,
  r: number,
): void {
  const soak = getSoak(enemy);
  if (soak <= 0) return;
  const alpha = Math.min(0.55, 0.18 + soak / 180);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(49, 130, 206, ${alpha})`;
  ctx.fill();
}

function drawStatusRings(
  ctx: CanvasRenderingContext2D,
  enemy: Enemy,
  game: GameState,
  x: number,
  y: number,
  r: number,
): void {
  if (isKindled(enemy, game)) {
    ctx.beginPath();
    ctx.arc(x, y, r + 2.5, 0, Math.PI * 2);
    ctx.strokeStyle = colors.statusKindled;
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }
  if (isImmolating(enemy, game)) {
    ctx.beginPath();
    ctx.arc(x, y, r + (isKindled(enemy, game) ? 5 : 2.5), 0, Math.PI * 2);
    ctx.strokeStyle = colors.statusImmolate;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

function drawStatusBadges(
  ctx: CanvasRenderingContext2D,
  enemy: Enemy,
  game: GameState,
  x: number,
  y: number,
  r: number,
): void {
  const badges: { glyph: string; color: string }[] = [];
  if (isKindled(enemy, game)) badges.push({ glyph: 'K', color: colors.statusKindled });
  const soak = getSoak(enemy);
  if (soak > 0) badges.push({ glyph: soak >= 10 ? '~~' : '~', color: colors.statusSoak });
  if (isImmolating(enemy, game)) badges.push({ glyph: 'I', color: colors.statusImmolate });
  if (isDiscombobulated(enemy)) badges.push({ glyph: '?', color: colors.statusDiscombobulated });
  if (badges.length === 0) return;

  const fontSize = Math.max(9, Math.floor(r * 0.85));
  const padX = 3;
  const padY = 1;
  ctx.font = `bold ${fontSize}px monospace`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  let cursorX = x - r;
  const badgeY = y + r + fontSize * 0.7 + 2;
  for (const badge of badges) {
    const w = ctx.measureText(badge.glyph).width + padX * 2;
    const h = fontSize + padY * 2;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(cursorX, badgeY - h / 2, w, h);
    ctx.strokeStyle = badge.color;
    ctx.lineWidth = 1;
    ctx.strokeRect(cursorX + 0.5, badgeY - h / 2 + 0.5, w - 1, h - 1);
    ctx.fillStyle = badge.color;
    ctx.fillText(badge.glyph, cursorX + padX, badgeY);
    cursorX += w + 2;
  }
}

function interpolatedEnemyPos(enemy: { id: string; pos: { col: number; row: number; face: ExteriorFace } }, snapshot: Snapshot): { col: number; row: number; face: ExteriorFace } {
  const prev = snapshot.previousEnemyPositions.get(enemy.id);
  if (!prev || snapshot.renderAlpha >= 1) return enemy.pos;
  return { col: prev.col + (enemy.pos.col - prev.col) * snapshot.renderAlpha, row: prev.row + (enemy.pos.row - prev.row) * snapshot.renderAlpha, face: enemy.pos.face };
}
