import { roomAt } from '@/model/tower';
import type { Store } from '@/store/store';
import { screenToCell } from './canvas/camera';

export interface PointerTracker { x: number; y: number }

const DRAG_THRESHOLD_PX = 5;

export function attachInput(
  canvas: HTMLCanvasElement,
  stage: HTMLElement,
  store: Store,
  pointer: PointerTracker,
): void {
  let dragStart: { x: number; y: number } | null = null;
  let isDragging = false;
  let lastDragCell: { col: number; row: number } | null = null;

  function cellFromEvent(e: MouseEvent | PointerEvent): { col: number; row: number } {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const { cameraScrollY, viewportHeight } = store.getSnapshot().view;
    return screenToCell(
      (e.clientX - rect.left) * scaleX,
      (e.clientY - rect.top) * scaleY,
      cameraScrollY,
      viewportHeight,
    );
  }

  canvas.addEventListener('pointermove', (e) => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    store.dispatch({ type: 'hoverCell', cell: cellFromEvent(e) });

    if (!dragStart || e.buttons !== 1) return;

    const dist = Math.hypot(e.clientX - dragStart.x, e.clientY - dragStart.y);
    if (!isDragging && dist > DRAG_THRESHOLD_PX) {
      isDragging = true;
    }

    if (!isDragging) return;

    const { game } = store.getSnapshot();
    if (game.phase !== 'build') return;

    const cell = cellFromEvent(e);
    if (roomAt(game.tower, cell.col, cell.row)) return;
    if (lastDragCell?.col === cell.col && lastDragCell.row === cell.row) return;

    lastDragCell = cell;
    store.dispatch({ type: 'placeSelectedAt', cell });
  });

  canvas.addEventListener('pointerleave', () => {
    store.dispatch({ type: 'hoverCell', cell: null });
  });

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    dragStart = { x: e.clientX, y: e.clientY };
    isDragging = false;
    lastDragCell = null;
    canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener('pointerup', (e) => {
    if (e.button !== 0) return;

    const cell = cellFromEvent(e);
    if (dragStart && !isDragging) {
      const { game } = store.getSnapshot();
      const room = roomAt(game.tower, cell.col, cell.row);
      if (room) {
        store.dispatch({ type: 'inspectRoomAt', cell });
      } else if (game.phase === 'build') {
        store.dispatch({ type: 'placeSelectedAt', cell });
      }
    }

    if (canvas.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }
    dragStart = null;
    isDragging = false;
    lastDragCell = null;
  });

  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    store.dispatch({ type: 'removeRoomAt', cell: cellFromEvent(e) });
  });

  stage.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      store.dispatch({ type: 'scrollCamera', deltaY: e.deltaY });
    },
    { passive: false },
  );
}
