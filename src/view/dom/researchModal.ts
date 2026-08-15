import { RESEARCH_QUEUE_CAP } from '@/config/research';
import { formatResourceCost } from '@/calculations/resources';
import { getResearchNode } from '@/model/research';
import {
  RESEARCH_DAG_LAYER_GAP,
  RESEARCH_DAG_NODE_SIZE,
  selectResearchDag,
  type ResearchDagNodeView,
  type ResearchDagView,
} from '@/store/selectors';
import type { Store } from '@/store/store';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function edgePath(
  from: { x: number; y: number },
  to: { x: number; y: number },
): string {
  const { w, h } = RESEARCH_DAG_NODE_SIZE;
  const x1 = from.x + w / 2;
  const y1 = from.y + h;
  const x2 = to.x + w / 2;
  const y2 = to.y;
  const adjacentSpan = h + RESEARCH_DAG_LAYER_GAP;
  if (y2 - y1 <= adjacentSpan + 1) {
    const my = (y1 + y2) / 2;
    return `M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`;
  }
  // Skip-layer: arc beside both nodes so the curve stays out of intervening rows.
  const xBend = Math.max(from.x, to.x) + w + 24;
  return `M${x1},${y1} C${xBend},${y1 + 28} ${xBend},${y2 - 28} ${x2},${y2}`;
}

function nodeClass(node: ResearchDagNodeView, selected: boolean): string {
  const parts = ['research-dag-node', `status-${node.status}`];
  if (selected) parts.push('selected');
  return parts.join(' ');
}

function renderGraph(dag: ResearchDagView, devMode: boolean): string {
  const { w, h } = RESEARCH_DAG_NODE_SIZE;
  const pos = new Map<string, { x: number; y: number }>([
    ...dag.nodes.map((n) => [n.id, n] as const),
    ...dag.groups.filter((g) => g.collapsed).map((g) => [g.id, g] as const),
  ]);
  const skipBend = dag.edges.reduce((max, e) => {
    const from = pos.get(e.from);
    const to = pos.get(e.to);
    if (!from || !to) return max;
    if (to.y - from.y - h <= RESEARCH_DAG_LAYER_GAP + 1) return max;
    return Math.max(max, Math.max(from.x, to.x) + w + 24);
  }, 0);
  const maxX =
    Math.max(200, skipBend, ...dag.nodes.map((n) => n.x), ...dag.groups.map((g) => g.x)) + w + 48;
  const maxY = Math.max(120, ...dag.nodes.map((n) => n.y), ...dag.groups.map((g) => g.y)) + h + 40;

  const edges = dag.edges
    .map((e) => {
      const from = pos.get(e.from);
      const to = pos.get(e.to);
      if (!from || !to) return '';
      return `<path class="research-dag-edge" d="${edgePath(from, to)}" fill="none" />`;
    })
    .join('');

  const nodes = dag.nodes
    .map((n) => {
      const missing =
        n.missingPrereqNames.length > 0
          ? `<span class="research-dag-missing">Needs: ${escapeHtml(n.missingPrereqNames.join(', '))}</span>`
          : '';
      const cost = n.costLabel
        ? `<span class="research-dag-cost">${escapeHtml(n.costLabel)}</span>`
        : '';
      const unlockBtn = devMode
        ? `<button type="button" data-action="devUnlockResearch" data-node="${n.id}">Unlock</button>`
        : '';
      return `
        <div class="${nodeClass(n, n.id === dag.selectedId)}"
             style="left:${n.x}px;top:${n.y}px;width:${w}px;height:${h}px"
             data-action="selectResearchNode" data-node="${n.id}">
          <strong>${escapeHtml(n.name)}</strong>
          <span class="research-dag-unlock">${escapeHtml(n.unlockSummary)}</span>
          ${cost}
          ${missing}
          ${unlockBtn}
        </div>`;
    })
    .join('');

  const groups = dag.groups
    .map((g) => {
      if (!g.collapsed) {
        return `
          <button type="button" class="research-dag-group-toggle"
            style="left:${g.x}px;top:${Math.max(0, g.y - 28)}px;width:${w}px"
            data-action="toggleResearchGroup" data-group="${g.id}">▾ ${escapeHtml(g.label)}</button>`;
      }
      return `
        <button type="button" class="research-dag-node status-${g.status} group"
          style="left:${g.x}px;top:${g.y}px;width:${w}px;height:${h}px"
          data-action="toggleResearchGroup" data-group="${g.id}">
          <strong>${escapeHtml(g.label)}</strong>
          <span>${g.childIds.length} techs · expand</span>
        </button>`;
    })
    .join('');

  return `
    <div class="research-dag-scroll" data-frontier-y="${dag.frontierFocusY}">
      <div class="research-dag-canvas" style="width:${maxX}px;height:${maxY}px">
        <svg class="research-dag-svg" width="${maxX}" height="${maxY}">${edges}</svg>
        ${groups}
        ${nodes}
      </div>
    </div>`;
}

function detailPane(dag: ResearchDagView, devMode: boolean): string {
  const selected = dag.nodes.find((n) => n.id === dag.selectedId);
  if (!selected) {
    return `<div class="research-detail"><p class="hint">Select a tech in the graph.</p></div>`;
  }

  const primary =
    selected.status === 'available'
      ? dag.busy
        ? `<button type="button" class="primary" data-action="enqueueResearch" data-node="${selected.id}" ${
            dag.canEnqueue ? '' : 'disabled'
          }>Enqueue · ${escapeHtml(selected.costLabel ?? '')}</button>`
        : `<button type="button" class="primary" data-action="startResearch" data-node="${selected.id}" ${
            dag.canStart ? '' : 'disabled'
          }>Start research · ${escapeHtml(selected.costLabel ?? '')}</button>`
      : '';

  const cancelBlock =
    selected.status === 'active'
      ? `<div class="research-cancel-block">
           <p class="warning">Cancel refunds half the start cost and loses all progress.</p>
           <button type="button" class="danger" data-action="cancelResearchConfirm">Cancel research…</button>
           <div class="research-cancel-confirm" hidden>
             <p>Refund half of ${escapeHtml(formatResourceCost(selected.startCost))}. Progress will be lost.</p>
             <button type="button" class="danger" data-action="cancelResearch">Confirm cancel</button>
             <button type="button" data-action="cancelResearchAbort">Keep researching</button>
           </div>
         </div>`
      : '';

  const dequeue =
    selected.status === 'queued'
      ? `<button type="button" data-action="dequeueResearch" data-node="${selected.id}">Remove from queue (full refund)</button>`
      : '';

  return `
    <div class="research-detail">
      <h3>${escapeHtml(selected.name)}</h3>
      <p>${escapeHtml(selected.description)}</p>
      <div class="stat"><span>Unlocks</span><strong>${escapeHtml(selected.unlockSummary)}</strong></div>
      <div class="stat"><span>Labor</span><strong>${selected.progressRequired}</strong></div>
      ${
        selected.costLabel
          ? `<div class="stat"><span>Cost</span><strong>${escapeHtml(selected.costLabel)}</strong></div>`
          : ''
      }
      ${
        selected.missingPrereqNames.length
          ? `<p class="warning">Missing: ${escapeHtml(selected.missingPrereqNames.join(', '))}</p>`
          : ''
      }
      <div class="research-detail-actions">
        ${primary}
        ${dequeue}
        ${cancelBlock}
      </div>
      ${devMode ? `<button type="button" data-action="devUnlockResearch" data-node="${selected.id}">Dev Unlock</button>` : ''}
    </div>`;
}

function queueStrip(dag: ResearchDagView): string {
  if (dag.queueIds.length === 0) {
    return `<div class="research-queue-strip"><span class="hint">Queue empty (0 / ${RESEARCH_QUEUE_CAP})</span></div>`;
  }
  const items = dag.queueIds
    .map((id) => {
      const node = getResearchNode(id);
      const name = node?.name ?? id;
      return `<li>
        <button type="button" data-action="selectResearchNode" data-node="${id}">${escapeHtml(name)}</button>
        <button type="button" data-action="dequeueResearch" data-node="${id}" title="Full refund">×</button>
      </li>`;
    })
    .join('');
  return `
    <div class="research-queue-strip">
      <strong>Queue (${dag.queueIds.length} / ${RESEARCH_QUEUE_CAP})</strong>
      <ol>${items}</ol>
    </div>`;
}

export function researchModalBody(store: Store): string {
  const snapshot = store.getSnapshot();
  const dag = selectResearchDag(snapshot);
  const devMode = snapshot.game.devMode;
  return `
    <div class="research-modal">
      <h3>Research tree</h3>
      ${queueStrip(dag)}
      <div class="research-modal-main">
        ${renderGraph(dag, devMode)}
        ${detailPane(dag, devMode)}
      </div>
      <div class="research-modal-footer">
        ${devMode ? '<button type="button" data-action="devUnlockAll">Unlock all</button>' : ''}
        <button type="button" class="primary" data-action="closeModal">Close</button>
      </div>
    </div>`;
}

export function bindResearchModalInteractions(root: HTMLElement, store: Store): void {
  root.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const snapshot = store.getSnapshot();
    if (snapshot.view.modal?.kind !== 'research') return;

    const target =
      e.target instanceof HTMLElement
        ? e.target.closest<HTMLElement>('[data-action]')
        : null;
    if (!target) return;
    if (target instanceof HTMLButtonElement && target.disabled) return;

    const action = target.dataset.action;
    const nodeId = target.dataset.node;
    const groupId = target.dataset.group;

    // Don't let node-select steal clicks from nested Unlock buttons.
    if (
      action === 'selectResearchNode' &&
      e.target instanceof HTMLElement &&
      e.target.closest('[data-action="devUnlockResearch"]')
    ) {
      return;
    }

    switch (action) {
      case 'selectResearchNode':
        if (nodeId) store.dispatch({ type: 'selectResearchNode', nodeId });
        break;
      case 'toggleResearchGroup':
        if (groupId) store.dispatch({ type: 'toggleResearchGroup', groupId });
        break;
      case 'startResearch':
        if (nodeId) store.dispatch({ type: 'startResearch', nodeId });
        break;
      case 'enqueueResearch':
        if (nodeId) store.dispatch({ type: 'enqueueResearch', nodeId });
        break;
      case 'dequeueResearch':
        e.stopPropagation();
        if (nodeId) store.dispatch({ type: 'dequeueResearch', nodeId });
        break;
      case 'cancelResearchConfirm': {
        const block = root.querySelector('.research-cancel-confirm');
        if (block instanceof HTMLElement) block.hidden = false;
        break;
      }
      case 'cancelResearchAbort': {
        const block = root.querySelector('.research-cancel-confirm');
        if (block instanceof HTMLElement) block.hidden = true;
        break;
      }
      case 'cancelResearch':
        store.dispatch({ type: 'cancelResearch' });
        break;
      case 'devUnlockResearch':
        e.stopPropagation();
        if (nodeId) store.dispatch({ type: 'devUnlockResearch', nodeId });
        break;
      case 'devUnlockAll':
        store.dispatch({ type: 'devUnlockAll' });
        break;
      default:
        break;
    }
  });
}

export function scrollResearchDagToFrontier(root: HTMLElement): void {
  const scroll = root.querySelector('.research-dag-scroll');
  if (!(scroll instanceof HTMLElement)) return;
  const focusY = Number(scroll.dataset.frontierY ?? 0);
  scroll.scrollTop = Math.max(0, focusY - 40);
}
