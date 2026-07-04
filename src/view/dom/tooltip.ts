import { getBlueprint } from '@/model/blueprints';
import { roomAt } from '@/model/tower';
import { selectGhostPlacement } from '@/store/selectors';
import type { Store } from '@/store/store';
import type { PointerTracker } from '../input';

export function createTooltip(root: HTMLElement, store: Store, pointer: PointerTracker): () => void {
  return function render(): void {
    const { game, view } = store.getSnapshot();
    const cell = view.hoveredCell;
    if (!cell || game.scene !== 'run') {
      root.style.display = 'none';
      return;
    }

    const room = roomAt(game.tower, cell.col, cell.row);
    let text = '';
    if (game.phase === 'build' && view.selectedBlueprintId) {
      const ghost = selectGhostPlacement(store.getSnapshot());
      const blueprint = getBlueprint(view.selectedBlueprintId);
      if (ghost && blueprint) {
        const action = room ? 'Replace with' : 'Place';
        text = ghost.valid
          ? `${action} ${blueprint.name} · ${blueprint.cost} gold`
          : `Cannot build: ${ghost.reason.replace(/_/g, ' ')}`;
      }
    } else if (room) {
      const blueprint = getBlueprint(room.blueprintId);
      text = `${blueprint?.name ?? 'Room'} · ${room.hp} hp`;
    }

    if (!text) {
      root.style.display = 'none';
      return;
    }

    root.textContent = text;
    root.style.display = 'block';
    root.style.left = `${pointer.x + 14}px`;
    root.style.top = `${pointer.y + 14}px`;
  };
}
