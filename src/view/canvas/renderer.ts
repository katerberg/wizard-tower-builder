import { CELL_SIZE, GRID_COLS, GRID_ROWS, colors } from '@/config/constants';
import { getBlueprint } from '@/model/blueprints';
import { getEnemyTemplate } from '@/model/enemies';
import { computeRoomStats } from '@/calculations/combat';
import { getUnstableRoomIds } from '@/model/tower';
import { selectGhostPlacement, selectWizardPosition } from '@/store/selectors';
import type { Snapshot } from '@/store/store';
import { BOARD_HEIGHT, BOARD_WIDTH, cellCenter, cellTopLeft } from './camera';

export class Renderer {
  private ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d canvas context unavailable');
    this.ctx = ctx;
    canvas.width = BOARD_WIDTH;
    canvas.height = BOARD_HEIGHT;
  }

  draw(snapshot: Snapshot): void {
    const { ctx } = this;
    ctx.clearRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

    this.drawGrid();
    this.drawGround();
    this.drawRooms(snapshot);
    this.drawGhost(snapshot);
    if (snapshot.game.devMode) this.drawPaths(snapshot);
    this.drawEnemies(snapshot);
    this.drawWizard(snapshot);
  }

  private drawGrid(): void {
    const { ctx } = this;
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    for (let c = 0; c <= GRID_COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * CELL_SIZE, 0);
      ctx.lineTo(c * CELL_SIZE, BOARD_HEIGHT);
      ctx.stroke();
    }
    for (let r = 0; r <= GRID_ROWS + 1; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * CELL_SIZE);
      ctx.lineTo(BOARD_WIDTH, r * CELL_SIZE);
      ctx.stroke();
    }
  }

  private drawGround(): void {
    const { ctx } = this;
    const groundTop = (GRID_ROWS + 1) * CELL_SIZE - 4;
    ctx.fillStyle = colors.ground;
    ctx.fillRect(0, groundTop, BOARD_WIDTH, 4);
  }

  private drawRooms(snapshot: Snapshot): void {
    const { ctx } = this;
    const unstable = getUnstableRoomIds(snapshot.game.tower);
    for (const room of snapshot.game.tower.rooms) {
      const blueprint = getBlueprint(room.blueprintId);
      const isUnstable = unstable.has(room.id);
      const topRow = room.origin.row + room.size.h - 1;
      const { x, y } = cellTopLeft(room.origin.col, topRow);
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
    }
  }

  private drawGhost(snapshot: Snapshot): void {
    const ghost = selectGhostPlacement(snapshot);
    if (!ghost) return;
    const { ctx } = this;
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = ghost.valid ? colors.ghostValid : colors.ghostInvalid;
    for (const cell of ghost.cells) {
      const { x, y } = cellTopLeft(cell.col, cell.row);
      ctx.fillRect(x + 2, y + 2, CELL_SIZE - 4, CELL_SIZE - 4);
    }
    ctx.globalAlpha = 1;
  }

  private drawEnemies(snapshot: Snapshot): void {
    const { ctx } = this;
    for (const enemy of snapshot.game.enemies) {
      const template = getEnemyTemplate(enemy.templateId);
      const { x, y } = cellCenter(enemy.pos.col, enemy.pos.row);
      const r = CELL_SIZE * 0.32;

      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = template?.color ?? colors.enemy;
      ctx.fill();

      ctx.fillStyle = '#1a202c';
      ctx.font = `${Math.floor(CELL_SIZE * 0.4)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(template?.glyph ?? 'e', x, y);

      if (template) {
        this.drawHpBar(x - r, y - r - 8, r * 2, enemy.currentHp / template.stats.maxHp);
      }
    }
  }

  private drawWizard(snapshot: Snapshot): void {
    if (snapshot.game.scene === 'menu') return;
    const { ctx } = this;
    const pos = selectWizardPosition(snapshot);
    const { x, y } = cellCenter(pos.col, pos.row);
    const wizard = snapshot.game.player.wizard;

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

  private drawPaths(snapshot: Snapshot): void {
    const { ctx } = this;
    ctx.strokeStyle = colors.pathDebug;
    ctx.lineWidth = 1;
    for (const enemy of snapshot.game.enemies) {
      if (enemy.path.length < 2) continue;
      ctx.beginPath();
      for (let i = enemy.pathIndex; i < enemy.path.length; i++) {
        const { x, y } = cellCenter(enemy.path[i].col, enemy.path[i].row);
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
