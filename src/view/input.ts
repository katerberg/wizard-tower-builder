import { roomAt } from '@/model/tower';
import type { Store } from '@/store/store';
import { screenToCell } from './canvas/camera';

export type PointerTracker = { x: number; y: number };

export function attachInput(canvas: HTMLCanvasElement, store: Store, pointer: PointerTracker): void {
  function cellFromEvent(e: MouseEvent): { col: number; row: number } {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return screenToCell((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY);
  }

  canvas.addEventListener('mousemove', (e) => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    store.dispatch({ type: 'hoverCell', cell: cellFromEvent(e) });
  });

  canvas.addEventListener('mouseleave', () => {
    store.dispatch({ type: 'hoverCell', cell: null });
  });

  canvas.addEventListener('click', (e) => {
    const cell = cellFromEvent(e);
    const { game } = store.getSnapshot();
    const room = roomAt(game.tower, cell.col, cell.row);
    if (room) {
      store.dispatch({ type: 'inspectRoomAt', cell });
    } else if (game.phase === 'build') {
      store.dispatch({ type: 'placeSelectedAt', cell });
    }
  });

  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    store.dispatch({ type: 'removeRoomAt', cell: cellFromEvent(e) });
  });
}
