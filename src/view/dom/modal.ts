import { selectRoomInspector, selectStructureInspector, type RoomInspector } from '@/store/selectors';
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
    } else if (action === 'sellStructure' && target?.dataset.structure) {
      store.dispatch({ type: 'sellStructure', structureId: target.dataset.structure });
    } else if (action === 'addModification' && target?.dataset.room && target.dataset.mod) {
      store.dispatch({ type: 'addModification', roomId: target.dataset.room, modId: target.dataset.mod });
    } else if (action === 'upgradeModification' && target?.dataset.room && target.dataset.mod) {
      store.dispatch({ type: 'upgradeModification', roomId: target.dataset.room, modId: target.dataset.mod });
    } else if (action === 'recruitStaff' && target?.dataset.room) {
      store.dispatch({ type: 'recruitStaff', housingRoomId: target.dataset.room });
    } else if (action === 'unrecruitStaff' && target?.dataset.room) {
      store.dispatch({ type: 'unrecruitStaff', housingRoomId: target.dataset.room });
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
    } else if (action === 'springMinus' && target?.dataset.room) {
      const inspector = selectRoomInspector(store.getSnapshot(), target.dataset.room);
      if (inspector?.manaSpringAllocated !== undefined) {
        store.dispatch({
          type: 'setManaSpringAllocation',
          springRoomId: target.dataset.room,
          count: inspector.manaSpringAllocated - 1,
        });
      }
    } else if (action === 'springPlus' && target?.dataset.room) {
      const inspector = selectRoomInspector(store.getSnapshot(), target.dataset.room);
      if (inspector?.manaSpringAllocated !== undefined) {
        store.dispatch({
          type: 'setManaSpringAllocation',
          springRoomId: target.dataset.room,
          count: inspector.manaSpringAllocated + 1,
        });
      }
    }
  });

  return function render(): void {
    const snapshot = store.getSnapshot();
    const { game, view } = snapshot;
    const modal = view.modal;
    if (
      !modal ||
      (game.phase === 'attack' && (modal.kind === 'room' || modal.kind === 'structure'))
    ) {
      root.innerHTML = '';
      return;
    }

    let body: string;
    if (modal.kind === 'room') {
      const inspector = selectRoomInspector(snapshot, modal.roomId);
      body = inspector ? roomBody(inspector) : '<p>Room no longer exists.</p>';
    } else if (modal.kind === 'structure') {
      const inspector = selectStructureInspector(snapshot, modal.structureId);
      body = inspector ? structureBody(inspector) : '<p>Structure no longer exists.</p>';
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

function staffTitle(kind: NonNullable<RoomInspector['housingStaffKind']>): string {
  switch (kind) {
    case 'soldier':
      return 'Soldiers';
    case 'mage':
      return 'Magi';
    case 'laborer':
      return 'Laborers';
  }
}

function structureBody(inspector: NonNullable<ReturnType<typeof selectStructureInspector>>): string {
  const { structure, blueprint, maxHp, isBuildPhase, canRemove, buildAlert } = inspector;
  const remove = canRemove
    ? `<button class="danger" data-action="sellStructure" data-structure="${structure.id}">Remove framing</button>`
    : '';
  const alertHtml = buildAlert ? `<p class="warning">${buildAlert}</p>` : '';
  return `
    <h3>${blueprint.name}</h3>
    <p class="hint">Framing — holds the tower up. Rooms and infra sit on top.</p>
    ${alertHtml}
    <div class="stat"><span>Size</span><strong>${structure.size.w}x${structure.size.h}</strong></div>
    <div class="stat"><span>HP</span><strong>${structure.hp} / ${maxHp}</strong></div>
    <div class="stat"><span>Origin</span><strong>(${structure.origin.col}, ${structure.origin.row})</strong></div>
    ${isBuildPhase ? remove : ''}`;
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
            ${mod.mechanics ? `<span class="mod-mechanics">${mod.mechanics}</span>` : ''}
          </span>
          ${control}
        </div>`;
    })
    .join('');

  let specialty = '';
  if (
    inspector.housingCapacity !== undefined &&
    inspector.housingRecruited !== undefined &&
    inspector.housingStaffKind &&
    inspector.recruitCost !== undefined
  ) {
    const full = inspector.housingRecruited >= inspector.housingCapacity;
    const atMin = inspector.housingRecruited <= 1;
    specialty = `
      <h4>${staffTitle(inspector.housingStaffKind)}</h4>
      <div class="stat"><span>Recruited</span><strong>${inspector.housingRecruited} / ${inspector.housingCapacity}</strong></div>
      ${
        isBuildPhase
          ? `<div class="slot-stepper">
               <button class="mod-btn ${atMin ? 'disabled' : ''}" data-action="unrecruitStaff" data-room="${room.id}">−</button>
               <button class="mod-btn ${full ? 'disabled' : ''}" data-action="recruitStaff" data-room="${room.id}">Recruit · ${inspector.recruitCost}g</button>
             </div>`
          : ''
      }`;
  }

  if (inspector.slotCapacity !== undefined && inspector.slotAllocated !== undefined) {
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
      }`;
  }

  if (inspector.manaSpringCapacity !== undefined && inspector.manaSpringAllocated !== undefined) {
    specialty += `
      <h4>Spring staffing</h4>
      <div class="stat"><span>Magi allocated</span><strong>${inspector.manaSpringAllocated} / ${inspector.manaSpringCapacity}</strong></div>
      ${
        isBuildPhase
          ? `<div class="slot-stepper">
               <button data-action="springMinus" data-room="${room.id}">−</button>
               <span>${inspector.manaSpringAllocated}</span>
               <button data-action="springPlus" data-room="${room.id}">+</button>
             </div>`
          : ''
      }`;
  }

  const remove = canRemove
    ? `<button class="danger" data-action="sellRoom" data-room="${room.id}">Remove room</button>`
    : '';

  const alertHtml = inspector.buildAlert
    ? `<p class="warning">${inspector.buildAlert}</p>`
    : '';

  const framingHtml = inspector.underStructure
    ? `<div class="stat framing-secondary"><span>Framing</span><strong>${inspector.underStructure.name} · ${inspector.underStructure.hp}/${inspector.underStructure.maxHp}</strong></div>`
    : '';

  return `
    <h3>${blueprint.name}</h3>
    ${alertHtml}
    <div class="stat"><span>Size</span><strong>${room.size.w}x${room.size.h}</strong></div>
    <div class="stat"><span>HP</span><strong>${room.hp} / ${stats.maxHp}</strong></div>
    <div class="stat"><span>Origin</span><strong>(${room.origin.col}, ${room.origin.row})</strong></div>
    ${framingHtml}
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
      <li>Build framing (spires / buttresses), then place rooms on top. Infra and rooms auto-add framing when needed.</li>
      <li>Recruit staff in housing, allocate slots and mana springs, connect floors with stairs.</li>
      <li>Crawlers climb the outside of framing and rooms; fliers pass through bare framing and only rooms block them.</li>
      <li>Workers need stairs to change floors even on empty framing.</li>
      <li>Right-click sells the room first (framing stays); click again to sell framing.</li>
      <li>Clear all 10 waves before the wizard's HP runs out.</li>
    </ul>`;
}
