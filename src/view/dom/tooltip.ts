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
    if (room) {
      const blueprint = getBlueprint(room.blueprintId);
      text = `${blueprint?.name ?? 'Room'} · ${room.hp} hp`;
    } else if (game.phase === 'build') {
      const ghost = selectGhostPlacement(store.getSnapshot());
      const blueprint = view.selectedBlueprintId ? getBlueprint(view.selectedBlueprintId) : undefined;
      if (ghost && blueprint) {
        text = ghost.valid
          ? `${blueprint.name} · ${blueprint.cost} mana`
          : `Cannot build: ${ghost.reason.replace(/_/g, ' ')}`;
      }
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
