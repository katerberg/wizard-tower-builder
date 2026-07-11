import { SOLDIER_RECRUIT_COST } from '@/config/constants';
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
    } else if (action === 'recruitSoldier' && target?.dataset.room) {
      store.dispatch({ type: 'recruitSoldier', barracksRoomId: target.dataset.room });
    } else if (action === 'slotMinus' && target?.dataset.room) {
      const inspector = selectRoomInspector(store.getSnapshot(), target.dataset.room);
      if (inspector?.slotAllocated !== undefined) {
        store.dispatch({
          type: 'setSlotAllocation',
          slotRoomId: target.dataset.room,
          count: inspector.slotAllocated - 1,
        });
      }
    } else if (action === 'slotPlus' && target?.dataset.room) {
      const inspector = selectRoomInspector(store.getSnapshot(), target.dataset.room);
      if (inspector?.slotAllocated !== undefined) {
        store.dispatch({
          type: 'setSlotAllocation',
          slotRoomId: target.dataset.room,
          count: inspector.slotAllocated + 1,
        });
      }
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

  let specialty = '';
  if (inspector.barracksCapacity !== undefined && inspector.barracksRecruited !== undefined) {
    const full = inspector.barracksRecruited >= inspector.barracksCapacity;
    specialty = `
      <h4>Soldiers</h4>
      <div class="stat"><span>Recruited</span><strong>${inspector.barracksRecruited} / ${inspector.barracksCapacity}</strong></div>
      ${
        isBuildPhase
          ? `<button class="mod-btn ${full ? 'disabled' : ''}" data-action="recruitSoldier" data-room="${room.id}">Recruit · ${SOLDIER_RECRUIT_COST}g</button>`
          : ''
      }`;
  }

  if (inspector.slotCapacity !== undefined && inspector.slotAllocated !== undefined) {
    const warn =
      inspector.slotConnected === false
        ? '<p class="warning">No path from barracks — soldiers cannot reach this slot.</p>'
        : '';
    specialty += `
      <h4>Slot staffing</h4>
      <div class="stat"><span>Allocated</span><strong>${inspector.slotAllocated} / ${inspector.slotCapacity}</strong></div>
      ${
        isBuildPhase
          ? `<div class="slot-stepper">
               <button data-action="slotMinus" data-room="${room.id}">−</button>
               <span>${inspector.slotAllocated}</span>
               <button data-action="slotPlus" data-room="${room.id}">+</button>
             </div>`
          : ''
      }
      ${warn}`;
  }

  const remove = canRemove
    ? `<button class="danger" data-action="sellRoom" data-room="${room.id}">Remove room</button>`
    : '';

  return `
    <h3>${blueprint.name}</h3>
    <div class="stat"><span>Size</span><strong>${room.size.w}x${room.size.h}</strong></div>
    <div class="stat"><span>HP</span><strong>${room.hp} / ${stats.maxHp}</strong></div>
    <div class="stat"><span>Origin</span><strong>(${room.origin.col}, ${room.origin.row})</strong></div>
    ${specialty}
    <h4>Modifications</h4>
    <div class="mod-list">${rows}</div>
    ${isBuildPhase ? '' : '<p class="hint">Modifications can only be changed during the build phase.</p>'}
    ${remove}`;
}

function helpBody(): string {
  return `
    <h3>How to play</h3>
    <ul class="help-list">
      <li>Recruit soldiers in barracks, allocate slot headcounts, connect with stairs (infra layer).</li>
      <li>Soldiers move during the attack phase; slots fire when troops arrive.</li>
      <li>Use the Select tool and click a room to add modifications or remove it.</li>
      <li>Pick a blueprint to place or replace rooms; Esc cancels the blueprint.</li>
      <li>Enemies climb the outside toward your wizard at the top.</li>
      <li>Rearrange freely until you start the wave.</li>
      <li>Clear all 10 waves before the wizard's HP runs out.</li>
    </ul>`;
}
