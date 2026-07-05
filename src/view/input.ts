import { roomAt } from '@/model/tower';
import { findEnemyAtCell, getSpell } from '@/model/spells';
import { selectSpellBar } from '@/store/selectors';
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

    const { game, view } = store.getSnapshot();
    if (game.phase !== 'build' || !view.selectedBlueprintId) return;

    const cell = cellFromEvent(e);
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
      const { game, view } = store.getSnapshot();
      if (game.phase === 'attack' && view.selectedSpellId) {
        const spell = getSpell(view.selectedSpellId);
        if (spell?.targeting === 'enemy') {
          const enemyId = findEnemyAtCell(game, cell);
          if (enemyId) {
            store.dispatch({ type: 'castSpellOnEnemy', spellId: view.selectedSpellId, enemyId });
          }
        } else {
          store.dispatch({ type: 'castSpellAt', spellId: view.selectedSpellId, cell });
        }
      } else if (game.phase === 'build' && view.selectedBlueprintId) {
        store.dispatch({ type: 'placeSelectedAt', cell });
      } else if (game.phase === 'build' && roomAt(game.tower, cell.col, cell.row)) {
        store.dispatch({ type: 'inspectRoomAt', cell });
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
    const { game } = store.getSnapshot();
    if (game.phase !== 'build') return;
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

  window.addEventListener('keydown', (e) => {
    const snapshot = store.getSnapshot();
    const { game, view } = snapshot;

    if (e.key >= '1' && e.key <= '6') {
      if (game.scene !== 'run' || game.phase !== 'attack') return;
      const slot = selectSpellBar(snapshot)[Number(e.key) - 1];
      if (!slot?.id || !slot.enabled) return;
      e.preventDefault();
      if (view.selectedSpellId === slot.id) {
        store.dispatch({ type: 'cancelCast' });
      } else {
        store.dispatch({ type: 'selectSpell', spellId: slot.id });
      }
      return;
    }

    if (e.key !== 'Escape') return;
    if (view.modal) {
      e.preventDefault();
      store.dispatch({ type: 'closeModal' });
    } else if (view.selectedSpellId) {
      e.preventDefault();
      store.dispatch({ type: 'cancelCast' });
    } else if (view.selectedBlueprintId) {
      e.preventDefault();
      store.dispatch({ type: 'selectBlueprint', blueprintId: null });
    }
  });
}
