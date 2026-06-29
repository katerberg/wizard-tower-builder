import { getBlueprint } from '@/model/blueprints';
import { computeRoomStats } from '@/calculations/combat';
import {
  canApplyModification,
  canUpgradeModification,
  listModifications,
  modificationCost,
} from '@/model/modifications';
import { selectBuildEconomy, selectRoomById } from '@/store/selectors';
import type { Snapshot, Store } from '@/store/store';
import type { Room } from '@/model/types';

export function createModal(root: HTMLElement, store: Store): () => void {
  root.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest('[data-action]') as HTMLElement | null;
    if (target?.classList.contains('disabled')) return;
    const action = target?.dataset.action;
    if (!action && (e.target as HTMLElement).classList.contains('modal-backdrop')) {
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

    let body = '';
    if (modal.kind === 'room') {
      const room = selectRoomById(snapshot, modal.roomId);
      body = room ? roomBody(snapshot, room) : '<p>Room no longer exists.</p>';
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

function roomBody(snapshot: Snapshot, room: Room): string {
  const { game } = snapshot;
  const blueprint = getBlueprint(room.blueprintId);
  if (!blueprint) return '<p>Room no longer exists.</p>';

  const stats = computeRoomStats(room, blueprint);
  const isBuild = game.scene === 'run' && game.phase === 'build';
  const { remainingGold } = selectBuildEconomy(snapshot);

  const rows = listModifications()
    .map((def) => {
      const current = room.modifications.find((m) => m.id === def.id);
      const level = current?.level ?? 0;
      const levelText = level > 0 ? `Lv${level}/${def.maxLevel}` : 'not installed';

      let control = '';
      if (!isBuild) {
        control = '';
      } else if (level === 0) {
        const cost = modificationCost(def, 1);
        const allowed = canApplyModification(room, game.tower, def.id) && remainingGold >= cost;
        control = `<button class="mod-btn ${allowed ? '' : 'disabled'}" data-action="addModification" data-room="${room.id}" data-mod="${def.id}">Add · ${cost}g</button>`;
      } else if (canUpgradeModification(room, def.id)) {
        const cost = modificationCost(def, level + 1);
        const allowed = remainingGold >= cost;
        control = `<button class="mod-btn ${allowed ? '' : 'disabled'}" data-action="upgradeModification" data-room="${room.id}" data-mod="${def.id}">Upgrade · ${cost}g</button>`;
      } else {
        control = '<span class="mod-max">Max</span>';
      }

      return `
        <div class="mod-row">
          <span class="mod-glyph" style="color:${def.color}">${def.glyph}</span>
          <span class="mod-info">
            <strong>${def.name}</strong> <span class="mod-level">${levelText}</span>
            <span class="mod-desc">${def.description}</span>
          </span>
          ${control}
        </div>`;
    })
    .join('');

  const remove = isBuild
    ? `<button class="danger" data-action="sellRoom" data-room="${room.id}">Remove room</button>`
    : '';

  return `
    <h3>${blueprint.name}</h3>
    <div class="stat"><span>Size</span><strong>${room.size.w}x${room.size.h}</strong></div>
    <div class="stat"><span>HP</span><strong>${room.hp} / ${stats.maxHp}</strong></div>
    <div class="stat"><span>Origin</span><strong>(${room.origin.col}, ${room.origin.row})</strong></div>
    <h4>Modifications</h4>
    <div class="mod-list">${rows}</div>
    ${isBuild ? '' : '<p class="hint">Modifications can only be changed during the build phase.</p>'}
    ${remove}`;
}

function helpBody(): string {
  return `
    <h3>How to play</h3>
    <ul class="help-list">
      <li>Build a tower from blueprints, then start the wave.</li>
      <li>Enemies climb the outside toward your wizard at the top.</li>
      <li>The wizard auto-zaps the nearest climber in range.</li>
      <li>Click a room while building to add modifications or remove it. Rearrange freely until you start the wave.</li>
      <li>A taller, longer approach keeps enemies in range while they climb.</li>
      <li>Spire blocks need ground or a room directly below; they cannot overhang.</li>
      <li>Buttress rooms (2 or 3 wide) can cantilever at most one step.</li>
      <li>The whole tower must stay one connected structure — no second base elsewhere.</li>
      <li>Clear all 10 waves before the wizard's HP runs out.</li>
    </ul>`;
}
