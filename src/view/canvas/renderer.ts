import { CELL_SIZE, GRID_COLS, SUB_CELL_SIZE, SUB_CELLS_PER_MACRO, colors } from '@/config/constants';
import { sameMacroCell } from '@/calculations/subGrid';
import { getBlueprint } from '@/model/blueprints';
import { getEnemyTemplate } from '@/model/enemies';
import { getModification } from '@/model/modifications';
import { computeRoomStats } from '@/calculations/combat';
import { getUnstableRoomIds } from '@/model/tower';
import { selectCastPreview, selectGhostPlacement, selectWizardPosition } from '@/store/selectors';
import type { Snapshot } from '@/store/store';
import { BOARD_WIDTH, cellCenter, cellTopLeft, enemyDrawRadius, exteriorNodeDrawCenter, GROUND_LINE_INSET, visibleRowRange } from './camera';

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private lastHeight = 0;

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d canvas context unavailable');
    this.canvas = canvas;
    this.ctx = ctx;
    canvas.width = BOARD_WIDTH;
  }

  draw(snapshot: Snapshot): void {
    const { ctx, canvas } = this;
    const scrollY = snapshot.view.cameraScrollY;
    const viewportHeight = snapshot.view.viewportHeight;

    if (viewportHeight !== this.lastHeight) {
      canvas.height = viewportHeight;
      this.lastHeight = viewportHeight;
    }

    ctx.clearRect(0, 0, BOARD_WIDTH, viewportHeight);
    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, BOARD_WIDTH, viewportHeight);

    this.drawGrid(scrollY, viewportHeight);
    this.drawGround(scrollY, viewportHeight);
    this.drawRooms(snapshot, scrollY, viewportHeight);
    this.drawGhost(snapshot, scrollY, viewportHeight);
    this.drawCastPreview(snapshot, scrollY, viewportHeight);
    this.drawFireEffects(snapshot, scrollY, viewportHeight);
    if (snapshot.game.devMode) this.drawPaths(snapshot, scrollY, viewportHeight);
    const wizardPos = selectWizardPosition(snapshot);
    this.drawEnemies(snapshot, wizardPos, scrollY, viewportHeight, 'climbers');
    this.drawWizard(snapshot, scrollY, viewportHeight);
    this.drawCastAimLine(snapshot, scrollY, viewportHeight);
    this.drawEnemies(snapshot, wizardPos, scrollY, viewportHeight, 'atWizard');
  }

  private drawGrid(scrollY: number, viewportHeight: number): void {
    const { ctx } = this;
    const { minRow, maxRow } = visibleRowRange(scrollY, viewportHeight);
    const minSubRow = minRow * SUB_CELLS_PER_MACRO;
    const maxSubRow = (maxRow + 1) * SUB_CELLS_PER_MACRO;

    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.35;
    for (let sc = 0; sc <= GRID_COLS * SUB_CELLS_PER_MACRO; sc++) {
      ctx.beginPath();
      ctx.moveTo(sc * SUB_CELL_SIZE, 0);
      ctx.lineTo(sc * SUB_CELL_SIZE, viewportHeight);
      ctx.stroke();
    }
    for (let sr = minSubRow; sr <= maxSubRow; sr++) {
      const y = viewportHeight - (sr + 1) * SUB_CELL_SIZE + scrollY;
      if (y < -SUB_CELL_SIZE || y > viewportHeight + SUB_CELL_SIZE) continue;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(BOARD_WIDTH, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    ctx.strokeStyle = colors.grid;
    for (let c = 0; c <= GRID_COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * CELL_SIZE, 0);
      ctx.lineTo(c * CELL_SIZE, viewportHeight);
      ctx.stroke();
    }
    for (let row = minRow; row <= maxRow; row++) {
      const y = cellTopLeft(0, row, scrollY, viewportHeight).y;
      if (y < -CELL_SIZE || y > viewportHeight + CELL_SIZE) continue;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(BOARD_WIDTH, y);
      ctx.stroke();
      const yBottom = y + CELL_SIZE;
      ctx.beginPath();
      ctx.moveTo(0, yBottom);
      ctx.lineTo(BOARD_WIDTH, yBottom);
      ctx.stroke();
    }
  }

  private drawGround(scrollY: number, viewportHeight: number): void {
    const { ctx } = this;
    const groundTop = viewportHeight + scrollY - SUB_CELL_SIZE;
    if (groundTop > viewportHeight || groundTop + SUB_CELL_SIZE < 0) return;
    ctx.fillStyle = colors.ground;
    ctx.fillRect(0, groundTop, BOARD_WIDTH, GROUND_LINE_INSET);
  }

  private drawRooms(snapshot: Snapshot, scrollY: number, viewportHeight: number): void {
    const { ctx } = this;
    const { minRow, maxRow } = visibleRowRange(scrollY, viewportHeight);
    const unstable = getUnstableRoomIds(snapshot.game.tower);
    for (const room of snapshot.game.tower.rooms) {
      const roomMinRow = room.origin.row;
      const roomMaxRow = room.origin.row + room.size.h - 1;
      if (roomMaxRow < minRow || roomMinRow > maxRow) continue;

      const blueprint = getBlueprint(room.blueprintId);
      const isUnstable = unstable.has(room.id);
      const topRow = roomMaxRow;
      const { x, y } = cellTopLeft(room.origin.col, topRow, scrollY, viewportHeight);
      const w = room.size.w * CELL_SIZE;
      const h = room.size.h * CELL_SIZE;

      ctx.fillStyle = blueprint?.color ?? colors.room;
      ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
      if (isUnstable) {
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = colors.ghostInvalid;
        ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
        ctx.globalAlpha = 1;
      }
      ctx.strokeStyle = isUnstable ? colors.ghostInvalid : colors.roomStroke;
      ctx.lineWidth = isUnstable ? 3 : 2;
      ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);

      ctx.fillStyle = colors.text;
      ctx.font = `${Math.floor(CELL_SIZE * 0.5)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(isUnstable ? '!' : blueprint?.glyph ?? '?', x + w / 2, y + h / 2);

      if (blueprint) {
        const stats = computeRoomStats(room, blueprint);
        if (room.hp < stats.maxHp) {
          this.drawHpBar(x + 4, y + 4, w - 8, room.hp / stats.maxHp);
        }
      }

      if (room.modifications.length > 0) {
        this.drawModIndicators(room.modifications, x, y + h);
      }
    }
  }

  private drawModIndicators(modifications: { id: string; level: number }[], left: number, bottom: number): void {
    const { ctx } = this;
    const size = Math.floor(CELL_SIZE * 0.28);
    const padX = 4;
    const padY = 2;
    const badgeH = size + padY * 2;
    const badgeBottom = bottom - 4;
    ctx.font = `${size}px monospace`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    let cursorX = left + 5;
    for (const mod of modifications) {
      const def = getModification(mod.id);
      if (!def) continue;
      const label = mod.level > 1 ? `${def.glyph}${mod.level}` : def.glyph;
      const textW = ctx.measureText(label).width;
      const badgeW = textW + padX * 2;
      const badgeY = badgeBottom - badgeH;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.fillRect(cursorX, badgeY, badgeW, badgeH);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.strokeRect(cursorX + 0.5, badgeY + 0.5, badgeW - 1, badgeH - 1);

      ctx.fillStyle = def.color;
      ctx.fillText(label, cursorX + padX, badgeBottom - padY);
      cursorX += badgeW + size * 0.35;
    }
  }

  private drawGhost(snapshot: Snapshot, scrollY: number, viewportHeight: number): void {
    const ghost = selectGhostPlacement(snapshot);
    if (!ghost) return;
    const { ctx } = this;
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = ghost.valid ? colors.ghostValid : colors.ghostInvalid;
    for (const cell of ghost.cells) {
      const { x, y } = cellTopLeft(cell.col, cell.row, scrollY, viewportHeight);
      ctx.fillRect(x + 2, y + 2, CELL_SIZE - 4, CELL_SIZE - 4);
    }
    ctx.globalAlpha = 1;
  }

  private drawCastPreview(snapshot: Snapshot, scrollY: number, viewportHeight: number): void {
    const preview = selectCastPreview(snapshot);
    if (!preview) return;
    const { ctx } = this;
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = preview.valid ? colors.spellValid : colors.spellInvalid;
    for (const cell of preview.cells) {
      const { x, y } = cellTopLeft(cell.col, cell.row, scrollY, viewportHeight);
      ctx.fillRect(x + 2, y + 2, CELL_SIZE - 4, CELL_SIZE - 4);
    }
    ctx.globalAlpha = 1;
  }

  /** Dotted line from the wizard to the hovered cell while aiming a targeted spell. */
  private drawCastAimLine(snapshot: Snapshot, scrollY: number, viewportHeight: number): void {
    const preview = selectCastPreview(snapshot);
    const target = snapshot.view.hoveredCell;
    if (!preview || !target) return;

    const wizardPos = selectWizardPosition(snapshot);
    const from = cellCenter(wizardPos.col, wizardPos.row, scrollY, viewportHeight);
    const to = cellCenter(target.col, target.row, scrollY, viewportHeight);

    const { ctx } = this;
    ctx.save();
    ctx.strokeStyle = preview.valid ? colors.spellAim : colors.spellAimOut;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.restore();
  }

  private drawFireEffects(snapshot: Snapshot, scrollY: number, viewportHeight: number): void {
    const { game } = snapshot;
    const { ctx } = this;

    for (const patch of game.kindlingPatches ?? []) {
      if (patch.expiresAt <= game.waveTimer) continue;
      const { x, y } = cellTopLeft(patch.col, patch.row, scrollY, viewportHeight);
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = colors.kindlingPatch;
      ctx.fillRect(x + 4, y + 4, CELL_SIZE - 8, CELL_SIZE - 8);
      ctx.strokeStyle = '#ecc94b';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 4, y + 4, CELL_SIZE - 8, CELL_SIZE - 8);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ecc94b';
      ctx.font = `${Math.floor(CELL_SIZE * 0.4)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('K', x + CELL_SIZE / 2, y + CELL_SIZE / 2);
    }

    for (const segment of game.wallOfFlameSegments ?? []) {
      if (segment.expiresAt <= game.waveTimer) continue;
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = colors.wallFlame;
      for (const cell of segment.cells) {
        const { x, y } = cellTopLeft(cell.col, cell.row, scrollY, viewportHeight);
        ctx.fillRect(x + 2, y + 2, CELL_SIZE - 4, CELL_SIZE - 4);
      }
      ctx.globalAlpha = 1;
    }
  }

  private drawEnemies(
    snapshot: Snapshot,
    wizardPos: { col: number; row: number },
    scrollY: number,
    viewportHeight: number,
    layer: 'climbers' | 'atWizard',
  ): void {
    const { ctx } = this;
    for (const enemy of snapshot.game.enemies) {
      const atWizard = sameMacroCell(enemy.pos, wizardPos);
      if (layer === 'climbers' ? atWizard : !atWizard) continue;

      const template = getEnemyTemplate(enemy.templateId);
      const pos = this.interpolatedEnemyPos(enemy, snapshot);
      const tier = template?.sizeTier ?? 'swarm';
      const r = enemyDrawRadius(tier);

      let x: number;
      let y: number;
      if (atWizard) {
        const draw = exteriorNodeDrawCenter(pos, scrollY, viewportHeight, r);
        const stagger = enemy.id.charCodeAt(enemy.id.length - 1) % 2 === 0 ? 1 : -1;
        x = draw.x + stagger * SUB_CELL_SIZE * 0.55;
        y = draw.y;
      } else {
        ({ x, y } = exteriorNodeDrawCenter(pos, scrollY, viewportHeight, r));
      }

      if (y + r < 0 || y - r > viewportHeight) continue;

      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = template?.color ?? colors.enemy;
      ctx.fill();

      ctx.fillStyle = '#1a202c';
      ctx.font = `${Math.floor(r * 1.2)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(template?.glyph ?? 'e', x, y);

      if (template && tier !== 'swarm') {
        this.drawHpBar(x - r, y - r - 6, r * 2, enemy.currentHp / template.stats.maxHp);
      }
    }
  }

  private interpolatedEnemyPos(
    enemy: { id: string; pos: { col: number; row: number; face: 'left' | 'right' | 'top' } },
    snapshot: Snapshot,
  ): { col: number; row: number; face: 'left' | 'right' | 'top' } {
    const prev = snapshot.previousEnemyPositions.get(enemy.id);
    const t = snapshot.renderAlpha;
    if (!prev || t >= 1) return enemy.pos;
    return {
      col: prev.col + (enemy.pos.col - prev.col) * t,
      row: prev.row + (enemy.pos.row - prev.row) * t,
      face: enemy.pos.face,
    };
  }

  private drawWizard(snapshot: Snapshot, scrollY: number, viewportHeight: number): void {
    if (snapshot.game.scene === 'menu') return;
    const { ctx } = this;
    const pos = selectWizardPosition(snapshot);
    const { x, y } = exteriorNodeDrawCenter(pos, scrollY, viewportHeight, CELL_SIZE * 0.36);
    const wizard = snapshot.game.player.wizard;

    if (y + CELL_SIZE * 0.36 < 0 || y - CELL_SIZE * 0.36 > viewportHeight) return;

    ctx.beginPath();
    ctx.arc(x, y, CELL_SIZE * 0.36, 0, Math.PI * 2);
    ctx.fillStyle = colors.wizard;
    ctx.fill();

    ctx.fillStyle = '#1a202c';
    ctx.font = `${Math.floor(CELL_SIZE * 0.5)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(wizard.glyph, x, y);

    this.drawHpBar(x - CELL_SIZE * 0.4, y - CELL_SIZE * 0.5, CELL_SIZE * 0.8, wizard.hp / wizard.maxHp);
  }

  private drawPaths(snapshot: Snapshot, scrollY: number, viewportHeight: number): void {
    const { ctx } = this;
    ctx.strokeStyle = colors.pathDebug;
    ctx.lineWidth = 1;
    for (const enemy of snapshot.game.enemies) {
      if (enemy.path.length < 2) continue;
      ctx.beginPath();
      for (let i = enemy.pathIndex; i < enemy.path.length; i++) {
        const node = enemy.path[i];
        const { x, y } = exteriorNodeDrawCenter(node, scrollY, viewportHeight, 4);
        if (i === enemy.pathIndex) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  private drawHpBar(x: number, y: number, width: number, ratio: number): void {
    const { ctx } = this;
    const clamped = Math.max(0, Math.min(1, ratio));
    ctx.fillStyle = colors.hpBarBg;
    ctx.fillRect(x, y, width, 4);
    ctx.fillStyle = colors.hpBar;
    ctx.fillRect(x, y, width * clamped, 4);
  }
}
