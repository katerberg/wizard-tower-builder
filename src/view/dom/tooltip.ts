import { getBlueprint } from '@/model/blueprints';
import { roomAt } from '@/model/tower';
import { selectGhostPlacement, selectUiTooltip, type UiTooltipTarget } from '@/store/selectors';
import type { Store } from '@/store/store';
import type { PointerTracker } from '../input';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderUiTooltip(content: ReturnType<typeof selectUiTooltip>): string {
  if (!content) return '';

  const stats = content.stats
    .map(
      (stat) => `
      <div class="ui-tooltip-stat${stat.accent ? ' accent' : ''}">
        <span class="ui-tooltip-stat-label">${escapeHtml(stat.label)}</span>
        <span class="ui-tooltip-stat-value">${escapeHtml(stat.value)}</span>
      </div>`,
    )
    .join('');

  const glyphStyle = content.glyphColor ? ` style="color:${content.glyphColor}"` : '';
  const footer = content.footer
    ? `<p class="ui-tooltip-footer">${escapeHtml(content.footer)}</p>`
    : '';

  return `
    <div class="ui-tooltip">
      <div class="ui-tooltip-header">
        <span class="ui-tooltip-glyph"${glyphStyle}>${escapeHtml(content.glyph)}</span>
        <span class="ui-tooltip-title">${escapeHtml(content.title)}</span>
      </div>
      <p class="ui-tooltip-desc">${escapeHtml(content.description)}</p>
      <div class="ui-tooltip-stats">${stats}</div>
      ${footer}
    </div>`;
}

function positionTooltip(root: HTMLElement, pointer: PointerTracker): void {
  const pad = 14;
  const margin = 8;
  root.style.display = 'block';
  root.style.left = '0';
  root.style.top = '0';

  const rect = root.getBoundingClientRect();
  let left = pointer.x + pad;
  let top = pointer.y + pad;

  if (left + rect.width > window.innerWidth - margin) {
    left = pointer.x - rect.width - pad;
  }
  if (top + rect.height > window.innerHeight - margin) {
    top = pointer.y - rect.height - pad;
  }

  left = Math.max(margin, Math.min(left, window.innerWidth - rect.width - margin));
  top = Math.max(margin, Math.min(top, window.innerHeight - rect.height - margin));

  root.style.left = `${left}px`;
  root.style.top = `${top}px`;
}

function readTooltipTarget(el: HTMLElement): UiTooltipTarget | null {
  const kind = el.dataset.tipKind;
  const id = el.dataset.tipId;
  if (kind === 'spell' && id) return { kind: 'spell', id };
  if (kind === 'blueprint' && id) return { kind: 'blueprint', id };
  if (kind === 'tool' && id) return { kind: 'tool', id };
  return null;
}

export function createTooltip(
  root: HTMLElement,
  store: Store,
  pointer: PointerTracker,
  sidebar: HTMLElement,
): () => void {
  let uiTarget: UiTooltipTarget | null = null;
  let paint: (() => void) | null = null;

  function requestPaint(): void {
    paint?.();
  }

  sidebar.addEventListener('pointerover', (e) => {
    const el = e.target instanceof HTMLElement ? e.target.closest<HTMLElement>('[data-tip-kind]') : null;
    if (!el) return;
    const target = readTooltipTarget(el);
    if (!target) return;
    uiTarget = target;
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    requestPaint();
  });

  sidebar.addEventListener('pointerout', (e) => {
    const el = e.target instanceof HTMLElement ? e.target.closest<HTMLElement>('[data-tip-kind]') : null;
    if (!el) return;
    const related = e.relatedTarget instanceof Node ? e.relatedTarget : null;
    if (related && el.contains(related)) return;
    uiTarget = null;
    requestPaint();
  });

  sidebar.addEventListener('pointermove', (e) => {
    if (!uiTarget) return;
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    requestPaint();
  });

  return function render(): void {
    paint = render;
    if (uiTarget) {
      const content = selectUiTooltip(store.getSnapshot(), uiTarget);
      if (content) {
        root.className = 'ui-tooltip-root';
        root.innerHTML = renderUiTooltip(content);
        positionTooltip(root, pointer);
        return;
      }
    }

    const { game, view } = store.getSnapshot();
    const cell = view.hoveredCell;
    if (!cell || game.scene !== 'run') {
      root.style.display = 'none';
      root.innerHTML = '';
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
    } else if (game.phase === 'build' && room) {
      const blueprint = getBlueprint(room.blueprintId);
      text = `${blueprint?.name ?? 'Room'} · ${room.hp} hp`;
    }

    if (!text) {
      root.style.display = 'none';
      root.innerHTML = '';
      return;
    }

    root.className = 'grid-tooltip-root';
    root.textContent = text;
    positionTooltip(root, pointer);
  };
}
