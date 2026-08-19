import { colors } from '@/view/theme';
import { getSolarCollectorPosition } from '@/model/wizard';
import type { Snapshot } from '@/store/store';
import { BOARD_WIDTH } from './camera';
import { drawEnemies } from './layers/enemies';
import {
  drawCastAimLine,
  drawCastPreview,
  drawConstructionOrders,
  drawGhost,
  drawGrid,
  drawGround,
  drawPaths,
  drawSolarCollector,
  drawWizard,
} from './layers/overlays';
import { drawSpellFx } from './layers/spellFx';
import { drawStaff } from './layers/staff';
import { drawInfra, drawTower, drawTowerAlerts } from './layers/tower';

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

    drawGrid(ctx, scrollY, viewportHeight);
    drawGround(ctx, scrollY, viewportHeight);
    if (snapshot.view.layerVisibility.rooms) drawTower(ctx, snapshot, scrollY, viewportHeight);
    if (snapshot.view.layerVisibility.infra) drawInfra(ctx, snapshot, scrollY, viewportHeight);
    drawConstructionOrders(ctx, snapshot, scrollY, viewportHeight);
    drawGhost(ctx, snapshot, scrollY, viewportHeight);
    drawCastPreview(ctx, snapshot, scrollY, viewportHeight);
    drawSpellFx(ctx, snapshot, scrollY, viewportHeight);
    if (snapshot.game.devMode) drawPaths(ctx, snapshot, scrollY, viewportHeight);
    const collectorPos = getSolarCollectorPosition(snapshot.game);
    drawEnemies(ctx, snapshot, collectorPos, scrollY, viewportHeight, 'climbers');
    if (snapshot.view.layerVisibility.workers) drawStaff(ctx, snapshot, scrollY, viewportHeight);
    drawSolarCollector(ctx, snapshot, scrollY, viewportHeight);
    drawWizard(ctx, snapshot, scrollY, viewportHeight);
    drawCastAimLine(ctx, snapshot, scrollY, viewportHeight);
    drawEnemies(ctx, snapshot, collectorPos, scrollY, viewportHeight, 'atWizard');
    if (snapshot.view.layerVisibility.rooms) drawTowerAlerts(ctx, snapshot, scrollY, viewportHeight);
  }
}
