import { formatResourceAmount, formatWaveHaul } from '@/calculations/resources';
import { selectRoomInspector, selectStructureInspector, type RoomInspector } from '@/store/selectors';
import FIXTURES from '@/test/balance/fixtures';
import type { Resources } from '@/model/types';
import type { BalanceBuild } from '@/test/balance/types';
import type { Store } from '@/store/store';
import {
  bindResearchModalInteractions,
  researchModalBody,
  restoreResearchDagScroll,
} from './researchModal';

export function createModal(root: HTMLElement, store: Store): () => void {
  bindResearchModalInteractions(root, store);

  root.addEventListener('pointerdown', (e) => {
    const snapshot = store.getSnapshot();
    if (snapshot.view.modal?.kind === 'research') {
      // Research actions handled via pointerdown in bindResearchModalInteractions
      // except backdrop / closeModal which share this listener.
    }
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
      return;
    }
    if (snapshot.view.modal?.kind === 'research') return;
    if (action === 'sellRoom' && target?.dataset.room) {
      store.dispatch({ type: 'sellRoom', roomId: target.dataset.room });
    } else if (action === 'sellStructure' && target?.dataset.structure) {
      store.dispatch({ type: 'sellStructure', structureId: target.dataset.structure });
    } else if (
      action === 'sellShell' &&
      target?.dataset.col !== undefined &&
      target?.dataset.row !== undefined
    ) {
      store.dispatch({
        type: 'sellShell',
        col: Number(target.dataset.col),
        row: Number(target.dataset.row),
      });
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
    } else if (action === 'researchMinus' && target?.dataset.room) {
      const inspector = selectRoomInspector(store.getSnapshot(), target.dataset.room);
      if (inspector?.researchAllocated !== undefined) {
        store.dispatch({
          type: 'setResearchAllocation',
          researchRoomId: target.dataset.room,
          count: inspector.researchAllocated - 1,
        });
      }
    } else if (action === 'researchPlus' && target?.dataset.room) {
      const inspector = selectRoomInspector(store.getSnapshot(), target.dataset.room);
      if (inspector?.researchAllocated !== undefined) {
        store.dispatch({
          type: 'setResearchAllocation',
          researchRoomId: target.dataset.room,
          count: inspector.researchAllocated + 1,
        });
      }
    } else if (action === 'leylineMinus' && target?.dataset.room) {
      const inspector = selectRoomInspector(store.getSnapshot(), target.dataset.room);
      if (inspector?.leylineAllocated !== undefined) {
        store.dispatch({
          type: 'setLeylineAllocation',
          leylineRoomId: target.dataset.room,
          count: inspector.leylineAllocated - 1,
        });
      }
    } else if (action === 'leylinePlus' && target?.dataset.room) {
      const inspector = selectRoomInspector(store.getSnapshot(), target.dataset.room);
      if (inspector?.leylineAllocated !== undefined) {
        store.dispatch({
          type: 'setLeylineAllocation',
          leylineRoomId: target.dataset.room,
          count: inspector.leylineAllocated + 1,
        });
      }
    } else if (action === 'devSaveTowerGenerate') {
      const nameInput = root.querySelector('#saveTowerName');
      const expectSelect = root.querySelector('#saveTowerExpect');
      if (nameInput instanceof HTMLInputElement && expectSelect instanceof HTMLSelectElement) {
        const name = nameInput.value.trim();
        const expect = expectSelect.value;
        if (name && (expect === 'clear' || expect === 'lose' || expect === 'raid')) {
          store.dispatch({ type: 'devSaveTower', name, expect: expect });
        }
      }
    } else if (action === 'devCopyFixture') {
      const textarea = root.querySelector('#fixtureJsonOutput');
      if (textarea instanceof HTMLTextAreaElement) {
        void navigator.clipboard.writeText(textarea.value).then(() => {
          const btn = root.querySelector('[data-action="devCopyFixture"]');
          if (btn instanceof HTMLButtonElement) {
            btn.textContent = 'Copied!';
            btn.disabled = true;
          }
        });
      }
    } else if (action === 'devLoadFixture' && target?.dataset.fixtureId) {
      store.dispatch({ type: 'devLoadFixture', fixtureId: target.dataset.fixtureId });
    } else if (action === 'devConfirmLoad' && target?.dataset.fixtureId) {
      store.dispatch({ type: 'devConfirmLoad', fixtureId: target.dataset.fixtureId });
    }
  });

  return function render(): void {
    const snapshot = store.getSnapshot();
    const { game, view } = snapshot;
    const modal = view.modal;
    if (
      !modal ||
      (game.phase === 'night' &&
        (modal.kind === 'room' || modal.kind === 'structure' || modal.kind === 'research'))
    ) {
      root.innerHTML = '';
      return;
    }

    if (modal.kind === 'research') {
      const prevScroll = root.querySelector('.research-dag-scroll');
      const savedScroll =
        prevScroll instanceof HTMLElement
          ? { left: prevScroll.scrollLeft, top: prevScroll.scrollTop }
          : null;
      root.innerHTML = `
        <div class="modal-backdrop"></div>
        <div class="modal-panel research-modal-panel">
          ${researchModalBody(store)}
        </div>`;
      restoreResearchDagScroll(root, savedScroll);
      return;
    }

    let body: string;
    if (modal.kind === 'room') {
      const inspector = selectRoomInspector(snapshot, modal.roomId);
      body = inspector ? roomBody(inspector) : '<p>Room no longer exists.</p>';
    } else if (modal.kind === 'structure') {
      const inspector = selectStructureInspector(snapshot, modal.structureId);
      body = inspector ? structureBody(inspector) : '<p>Structure no longer exists.</p>';
    } else if (modal.kind === 'waveClear') {
      body = waveClearBody(modal.gold, modal.haul, modal.prospectNote);
    } else if (modal.kind === 'saveTower') {
      body = saveTowerBody(modal);
    } else if (modal.kind === 'fixtureList') {
      body = fixtureListBody();
    } else if (modal.kind === 'fixtureConfirm') {
      body = fixtureConfirmBody(modal.fixtureId);
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
  const { structure, blueprint, maxHp, isBuildPhase, canRemove, buildAlert, shellEntries } = inspector;
  const remove = canRemove
    ? `<button class="danger" data-action="sellStructure" data-structure="${structure.id}">Remove framing</button>`
    : '';
  const alertHtml = buildAlert ? `<p class="warning">${buildAlert}</p>` : '';
  const shellHtml =
    shellEntries.length > 0
      ? `<div class="mod-list"><h4>Shell fortifications</h4>${shellEntries
        .map((s) => {
          const btn =
            isBuildPhase
              ? `<button class="mod-btn danger" data-action="sellShell" data-col="${s.col}" data-row="${s.row}">Remove</button>`
              : '';
          return `<div class="mod-row"><span class="mod-glyph">${s.glyph}</span><span class="mod-info"><strong>${s.name}</strong> <span class="mod-level">(${s.col},${s.row})</span></span>${btn}</div>`;
        })
        .join('')}</div>`
      : '';
  return `
    <h3>${blueprint.name}</h3>
    <p class="hint">Framing — holds the tower up. Rooms and infra sit on top.</p>
    ${alertHtml}
    <div class="stat"><span>Size</span><strong>${structure.size.w}x${structure.size.h}</strong></div>
    <div class="stat"><span>HP</span><strong>${structure.hp} / ${maxHp}</strong></div>
    <div class="stat"><span>Origin</span><strong>(${structure.origin.col}, ${structure.origin.row})</strong></div>
    ${shellHtml}
    ${isBuildPhase ? remove : ''}`;
}

function roomBody(inspector: RoomInspector): string {
  const { room, blueprint, stats, isBuildPhase, modifications, canRemove } = inspector;

  const rows = modifications
    .map((mod) => {
      let control = '';
      if (mod.action === 'add') {
        control = `<button class="mod-btn ${mod.enabled ? '' : 'disabled'}" data-action="addModification" data-room="${room.id}" data-mod="${mod.id}">Add · ${mod.costLabel}</button>`;
      } else if (mod.action === 'upgrade') {
        control = `<button class="mod-btn ${mod.enabled ? '' : 'disabled'}" data-action="upgradeModification" data-room="${room.id}" data-mod="${mod.id}">Upgrade · ${mod.costLabel}</button>`;
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
      ${isBuildPhase
        ? `<div class="slot-stepper">
               <button class="mod-btn stepper-btn ${atMin ? 'disabled' : ''}" data-action="unrecruitStaff" data-room="${room.id}">−</button>
               <button class="mod-btn ${full ? 'disabled' : ''}" data-action="recruitStaff" data-room="${room.id}">Recruit · ${inspector.recruitCost}g</button>
             </div>`
        : ''
      }`;
  }

  if (inspector.slotCapacity !== undefined && inspector.slotAllocated !== undefined) {
    specialty += `
      <h4>Slot staffing</h4>
      <div class="stat"><span>Allocated</span><strong>${inspector.slotAllocated} / ${inspector.slotCapacity}</strong></div>
      ${isBuildPhase
        ? `<div class="slot-stepper">
               <button class="stepper-btn" data-action="slotMinus" data-room="${room.id}">−</button>
               <span>${inspector.slotAllocated}</span>
               <button class="stepper-btn" data-action="slotPlus" data-room="${room.id}">+</button>
             </div>`
        : ''
      }`;
  }

  if (inspector.manaSpringCapacity !== undefined && inspector.manaSpringAllocated !== undefined) {
    specialty += `
      <h4>Spring staffing</h4>
      <div class="stat"><span>Magi allocated</span><strong>${inspector.manaSpringAllocated} / ${inspector.manaSpringCapacity}</strong></div>
      ${isBuildPhase
        ? `<div class="slot-stepper">
               <button class="stepper-btn" data-action="springMinus" data-room="${room.id}">−</button>
               <span>${inspector.manaSpringAllocated}</span>
               <button class="stepper-btn" data-action="springPlus" data-room="${room.id}">+</button>
             </div>`
        : ''
      }`;
  }

  if (inspector.researchCapacity !== undefined && inspector.researchAllocated !== undefined) {
    specialty += `
      <h4>Research staffing</h4>
      <div class="stat"><span>Magi allocated</span><strong>${inspector.researchAllocated} / ${inspector.researchCapacity}</strong></div>
      ${isBuildPhase
        ? `<div class="slot-stepper">
               <button class="stepper-btn" data-action="researchMinus" data-room="${room.id}">−</button>
               <span>${inspector.researchAllocated}</span>
               <button class="stepper-btn" data-action="researchPlus" data-room="${room.id}">+</button>
             </div>`
        : ''
      }`;
  }

  if (inspector.leylineCapacity !== undefined && inspector.leylineAllocated !== undefined) {
    specialty += `
      <h4>Leyline staffing</h4>
      <div class="stat"><span>Status</span><strong>${inspector.leylineStatus ?? '—'}</strong></div>
      <div class="stat"><span>Magi allocated</span><strong>${inspector.leylineAllocated} / ${inspector.leylineCapacity}</strong></div>
      ${isBuildPhase
        ? `<div class="slot-stepper">
               <button class="stepper-btn" data-action="leylineMinus" data-room="${room.id}">−</button>
               <span>${inspector.leylineAllocated}</span>
               <button class="stepper-btn" data-action="leylinePlus" data-room="${room.id}">+</button>
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

function waveClearBody(gold: number, haul: Resources, prospectNote: string | null): string {
  const haulLabel = formatWaveHaul(haul);
  const haulLine =
    haulLabel === 'nothing'
      ? '<p class="haul-empty">Mine haul: nothing this wave.</p>'
      : `<p class="haul-ok">Mine haul: <strong>${haulLabel}</strong></p>`;
  const prospectLine = prospectNote
    ? `<p class="haul-ok">Prospecting: <strong>${prospectNote}</strong></p>`
    : '';
  return `
    <h3>Wave cleared</h3>
    <p class="haul-ok">Clear reward: <strong>+${formatResourceAmount(gold)} gold</strong></p>
    ${haulLine}
    ${prospectLine}
    <p class="hint">Laborers mine when connected to ground by stairs or elevators.</p>`;
}

function helpBody(): string {
  return `
    <h3>How to play</h3>
    <ul class="help-list">
      <li>Build framing (spire blocks), then place rooms on top. Infra and rooms auto-add framing when needed.</li>
      <li>Recruit staff in housing, allocate slots and mana springs, connect floors with stairs.</li>
      <li>Surplus laborers harvest stone underground — quarters need stairs or elevators to reach ground.</li>
      <li>Crawlers climb the outside of framing and rooms toward the solar collector; fliers pass through bare framing and only rooms block them. The collector is an aggro magnet; if it breaks, enemies RAID nearby defenses and economy rooms. Lose only if every Storage Room is destroyed.</li>
      <li>In attack, click the board to move the wizard (firefighter) via stairs/elevators, or select a spell then click to cast. Flight lets you path through open air briefly.</li>
      <li>Demolishers cannot crawl under overhangs — they smash rooms, then framing, on their path. Collapses cascade and pipe networks re-resolve mid-wave.</li>
      <li>Workers need stairs to change floors even on empty framing.</li>
      <li>Right-click sells the room first (framing stays); click again to sell framing.</li>
      <li>Climb your framing toward height 100. Clear a wave while still at 100+ to win — taller towers face harder pressure, but collapse eases the next fight. Climb when ready; don't grind for a seal.</li>
    </ul>`;
}

/* ---- Save Tower Modal ---- */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function saveTowerBody(modal: { kind: 'saveTower'; fixture: Omit<BalanceBuild, 'id' | 'title' | 'expect'>; name?: string; expect?: 'clear' | 'lose' | 'raid' }): string {
  const name = modal.name ?? '';
  const expect = modal.expect ?? 'clear';
  const generated = modal.name && modal.expect;

  const fixtureJson = generated
    ? JSON.stringify({
      id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      title: name,
      expect: modal.expect,
      ...modal.fixture,
    }, null, 2)
    : '';

  return `
    <h3>Save tower as fixture</h3>
    <div class="stat"><span>Height</span><strong>${modal.fixture.height}</strong></div>
    <div class="stat"><span>Placements</span><strong>${modal.fixture.placements?.length ?? 0}</strong></div>
    <div class="form-row">
      <label for="saveTowerName">Name</label>
      <input id="saveTowerName" type="text" value="${escapeHtml(name)}" placeholder="my-turret-layout" ${generated ? 'disabled' : ''} />
    </div>
    <div class="form-row">
      <label>Expected outcome</label>
      <select id="saveTowerExpect" ${generated ? 'disabled' : ''}>
        <option value="clear" ${expect === 'clear' ? 'selected' : ''}>clear</option>
        <option value="lose" ${expect === 'lose' ? 'selected' : ''}>lose</option>
        <option value="raid" ${expect === 'raid' ? 'selected' : ''}>raid</option>
      </select>
    </div>
    ${generated
      ? `<textarea id="fixtureJsonOutput" readonly rows="12">${escapeHtml(fixtureJson)}</textarea>
       <div class="modal-actions">
         <button class="primary" data-action="devCopyFixture">Copy to clipboard</button>
         <p class="hint">Paste the JSON into <code>src/test/balance/fixtures.json</code>.</p>
       </div>`
      : `<button class="primary" data-action="devSaveTowerGenerate">Generate</button>`
    }
    ${!generated ? '<button data-action="closeModal">Cancel</button>' : ''}`;
}

/* ---- Load Tower Modal ---- */

function fixtureListBody(): string {
  if (FIXTURES.length === 0) {
    return `
      <h3>Load tower fixture</h3>
      <p class="hint">No fixtures available. Save a tower first, then paste it into <code>src/test/balance/fixtures.json</code>.</p>
      <button data-action="closeModal">Close</button>`;
  }

  const items = FIXTURES.map((f) =>
    `<div class="fixture-row">
      <button data-action="devLoadFixture" data-fixture-id="${escapeHtml(f.id)}">
        <strong>${escapeHtml(f.title)}</strong>
        <span class="fixture-meta">(${escapeHtml(f.expect)})</span>
      </button>
    </div>`,
  ).join('');

  return `
    <h3>Load tower fixture</h3>
    <p class="hint">Click a fixture to confirm. This replaces the current tower.</p>
    <div class="fixture-list">${items}</div>
    <button data-action="closeModal">Close</button>`;
}

function fixtureConfirmBody(fixtureId: string): string {
  const fixture = FIXTURES.find((f) => f.id === fixtureId);
  if (!fixture) return '<p>Fixture not found.</p>';

  return `
    <h3>Load fixture</h3>
    <p><strong>${escapeHtml(fixture.title)}</strong></p>
    <div class="stat"><span>Expect</span><strong>${escapeHtml(fixture.expect)}</strong></div>
    <div class="stat"><span>Height</span><strong>${fixture.height}</strong></div>
    <div class="stat"><span>Placements</span><strong>${fixture.placements?.length ?? 0}</strong></div>
    <p class="warning">This replaces your current tower. Unsaved changes will be lost.</p>
    <button class="primary" data-action="devConfirmLoad" data-fixture-id="${escapeHtml(fixture.id)}">Confirm load</button>
    <button data-action="closeModal">Cancel</button>`;
}
