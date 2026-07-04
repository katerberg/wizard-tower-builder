import { selectRoomInspector, type RoomInspector } from '@/store/selectors';
import type { Store } from '@/store/store';

export function createModal(root: HTMLElement, store: Store): () => void {
  root.addEventListener('click', (e) => {
    const target =
      e.target instanceof HTMLElement ? e.target.closest<HTMLElement>('[data-action]') : null;
    if (target?.classList.contains('disabled')) return;
    const action = target?.dataset.action;
    if (!action && e.target instanceof HTMLElement && e.target.classList.contains('modal-backdrop')) {
      store.dispatch({ type: 'closeModal' });
      return;
    }
    if (action === 'closeModal') {
      store.dispatch({ type: 'closeModal' });
    } else if (action === 'sellRoom' && target?.dataset.room) {
      store.dispatch({ type: 'sellRoom', roomId: target.dataset.room });
    } else if (action === 'addModification' && target?.dataset.room && target.dataset.mod) {
      store.dispatch({ type: 'addModification', roomId: target.dataset.room, modId: target.dataset.mod });
    } else if (action === 'upgradeModification' && target?.dataset.room && target.dataset.mod) {
      store.dispatch({ type: 'upgradeModification', roomId: target.dataset.room, modId: target.dataset.mod });
    }
  });

  return function render(): void {
    const snapshot = store.getSnapshot();
    const modal = snapshot.view.modal;
    if (!modal) {
      root.innerHTML = '';
      return;
    }

    let body: string;
    if (modal.kind === 'room') {
      const inspector = selectRoomInspector(snapshot, modal.roomId);
      body = inspector ? roomBody(inspector) : '<p>Room no longer exists.</p>';
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

function roomBody(inspector: RoomInspector): string {
  const { room, blueprint, stats, isBuildPhase, modifications, canRemove } = inspector;

  const rows = modifications
    .map((mod) => {
      let control = '';
      if (mod.action === 'add') {
        control = `<button class="mod-btn ${mod.enabled ? '' : 'disabled'}" data-action="addModification" data-room="${room.id}" data-mod="${mod.id}">Add · ${mod.cost}g</button>`;
      } else if (mod.action === 'upgrade') {
        control = `<button class="mod-btn ${mod.enabled ? '' : 'disabled'}" data-action="upgradeModification" data-room="${room.id}" data-mod="${mod.id}">Upgrade · ${mod.cost}g</button>`;
      } else if (mod.action === 'max') {
        control = '<span class="mod-max">Max</span>';
      }

      return `
        <div class="mod-row">
          <span class="mod-glyph" style="color:${mod.color}">${mod.glyph}</span>
          <span class="mod-info">
            <strong>${mod.name}</strong> <span class="mod-level">${mod.levelText}</span>
            <span class="mod-desc">${mod.description}</span>
          </span>
          ${control}
        </div>`;
    })
    .join('');

  const remove = canRemove
    ? `<button class="danger" data-action="sellRoom" data-room="${room.id}">Remove room</button>`
    : '';

  return `
    <h3>${blueprint.name}</h3>
    <div class="stat"><span>Size</span><strong>${room.size.w}x${room.size.h}</strong></div>
    <div class="stat"><span>HP</span><strong>${room.hp} / ${stats.maxHp}</strong></div>
    <div class="stat"><span>Origin</span><strong>(${room.origin.col}, ${room.origin.row})</strong></div>
    <h4>Modifications</h4>
    <div class="mod-list">${rows}</div>
    ${isBuildPhase ? '' : '<p class="hint">Modifications can only be changed during the build phase.</p>'}
    ${remove}`;
}

function helpBody(): string {
  return `
    <h3>How to play</h3>
    <ul class="help-list">
      <li>Use the Select tool and click a room to add modifications or remove it.</li>
      <li>Pick a blueprint to place or replace rooms; Esc cancels the blueprint.</li>
      <li>Enemies climb the outside toward your wizard at the top.</li>
      <li>The wizard auto-zaps the nearest climber in range.</li>
      <li>Rearrange freely until you start the wave.</li>
      <li>Spire blocks need ground or a room directly below; they cannot overhang.</li>
      <li>Buttress rooms (2 or 3 wide) can cantilever at most one step.</li>
      <li>The whole tower must stay one connected structure — no second base elsewhere.</li>
      <li>Clear all 10 waves before the wizard's HP runs out.</li>
    </ul>`;
}
