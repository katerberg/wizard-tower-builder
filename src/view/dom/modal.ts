import { getBlueprint } from '@/model/blueprints';
import { computeRoomStats } from '@/calculations/combat';
import { selectRoomById } from '@/store/selectors';
import type { Store } from '@/store/store';

export function createModal(root: HTMLElement, store: Store): () => void {
  root.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.dataset.action === 'closeModal' || target.classList.contains('modal-backdrop')) {
      store.dispatch({ type: 'closeModal' });
    }
  });

  return function render(): void {
    const snapshot = store.getSnapshot();
    const modal = snapshot.view.modal;
    if (!modal) {
      root.innerHTML = '';
      return;
    }

    let body = '';
    if (modal.kind === 'room') {
      const room = selectRoomById(snapshot, modal.roomId);
      const blueprint = room ? getBlueprint(room.blueprintId) : undefined;
      if (room && blueprint) {
        const stats = computeRoomStats(room, blueprint);
        body = `
          <h3>${blueprint.name}</h3>
          <div class="stat"><span>Size</span><strong>${room.size.w}x${room.size.h}</strong></div>
          <div class="stat"><span>HP</span><strong>${room.hp} / ${stats.maxHp}</strong></div>
          <div class="stat"><span>Origin</span><strong>(${room.origin.col}, ${room.origin.row})</strong></div>
          <div class="stat"><span>Contents</span><strong>${room.contents.length === 0 ? 'Empty (v1)' : room.contents.length}</strong></div>
          <p class="hint">Room modules and turrets arrive in a later version.</p>`;
      } else {
        body = '<p>Room no longer exists.</p>';
      }
    } else {
      body = helpBody();
    }

    root.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-panel">
        ${body}
        <button class="primary" data-action="closeModal">Close</button>
      </div>`;
  };
}

function helpBody(): string {
  return `
    <h3>How to play</h3>
    <ul class="help-list">
      <li>Build a tower from blueprints, then start the wave.</li>
      <li>Enemies climb the outside toward your wizard at the top.</li>
      <li>The wizard auto-zaps the nearest climber in range.</li>
      <li>A taller, longer approach keeps enemies in range while they climb.</li>
      <li>Cantilever requires a 2+ wide stabilizer room first.</li>
      <li>Clear all 10 waves before the wizard's HP runs out.</li>
    </ul>`;
}
