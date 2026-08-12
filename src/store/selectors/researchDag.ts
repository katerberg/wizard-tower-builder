import { RESEARCH_QUEUE_CAP } from '@/config/research';
import {
  asResources,
  canAffordResources,
  formatResourceCost,
} from '@/calculations/resources';
import {
  getResearchNode,
  listFrontierNodes,
  listResearchNodes,
  type ResearchNode,
  type ResearchNodeId,
} from '@/model/research';
import type { ResourceCost } from '@/model/types';
import type { Snapshot } from '../store';
import { selectBuildEconomy } from './build';

export type ResearchDagStatus =
  | 'completed'
  | 'active'
  | 'queued'
  | 'available'
  | 'preview';

export interface ResearchDagNodeView {
  id: ResearchNodeId;
  name: string;
  description: string;
  kind: ResearchNode['kind'];
  status: ResearchDagStatus;
  unlockSummary: string;
  costLabel: string | null;
  startCost: ResourceCost;
  progressRequired: number;
  missingPrereqNames: string[];
  affordable: boolean;
  /** Parent group id when this is a collapsed expansion child. */
  groupId: string | null;
  depth: number;
  x: number;
  y: number;
}

export interface ResearchDagEdgeView {
  from: ResearchNodeId;
  to: ResearchNodeId;
}

export interface ResearchDagGroupView {
  id: string;
  label: string;
  collapsed: boolean;
  childIds: string[];
  x: number;
  y: number;
}

export interface ResearchDagView {
  nodes: ResearchDagNodeView[];
  edges: ResearchDagEdgeView[];
  groups: ResearchDagGroupView[];
  /** Suggested scroll focus: min x of available nodes (or active). */
  frontierFocusX: number;
  selectedId: string | null;
  busy: boolean;
  queueIds: string[];
  canStart: boolean;
  canEnqueue: boolean;
  queueFull: boolean;
  active: null | { id: string; name: string; progress: number; required: number; ratio: number };
}

const NODE_W = 160;
const NODE_H = 56;
const COL_GAP = 48;
const ROW_GAP = 28;

function unlockSummary(node: ResearchNode): string {
  const parts: string[] = [];
  for (const id of node.unlocksBlueprints ?? []) parts.push(id);
  for (const id of node.unlocksModifications ?? []) parts.push(id);
  return parts.join(', ') || node.name;
}

function expansionGroupId(node: ResearchNode): string | null {
  if (node.kind !== 'expansion') return null;
  const parentBp = node.requires.find((id) => getResearchNode(id)?.kind === 'blueprint');
  if (parentBp) return `exp-group:${parentBp}`;
  return `exp-group:housing`;
}

function expansionGroupLabel(groupId: string): string {
  if (groupId === 'exp-group:housing') return 'Housing expansions';
  const parentId = groupId.replace(/^exp-group:/, '');
  const parent = getResearchNode(parentId);
  return parent ? `${parent.name} upgrades` : 'Upgrades';
}

function computeDepths(nodes: ResearchNode[]): Map<string, number> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const memo = new Map<string, number>();
  const depthOf = (id: string): number => {
    if (memo.has(id)) return memo.get(id)!;
    const node = byId.get(id);
    if (!node || node.requires.length === 0) {
      memo.set(id, 0);
      return 0;
    }
    const d = 1 + Math.max(...node.requires.map((r) => (byId.has(r) ? depthOf(r) : 0)));
    memo.set(id, d);
    return d;
  };
  for (const n of nodes) depthOf(n.id);
  return memo;
}

export function selectResearchDag(snapshot: Snapshot): ResearchDagView {
  const { game, view } = snapshot;
  const research = game.player.research;
  const completed = new Set(research.completedNodeIds);
  const queued = new Set(research.queue);
  const activeId = research.active?.nodeId ?? null;
  const frontier = new Set(listFrontierNodes(game).map((n) => n.id));
  const all = listResearchNodes();
  const byId = new Map(all.map((n) => [n.id, n]));

  const coreIds = new Set<string>();
  for (const id of completed) coreIds.add(id);
  if (activeId) coreIds.add(activeId);
  for (const id of queued) coreIds.add(id);
  for (const id of frontier) coreIds.add(id);

  const visibleIds = new Set(coreIds);
  for (const node of all) {
    if (coreIds.has(node.id)) continue;
    if (node.requires.some((r) => coreIds.has(r))) {
      visibleIds.add(node.id);
    }
  }

  const expanded = new Set(view.researchExpandedGroupIds);
  const groupChildren = new Map<string, string[]>();
  for (const node of all) {
    if (!visibleIds.has(node.id)) continue;
    const gid = expansionGroupId(node);
    if (!gid) continue;
    const list = groupChildren.get(gid) ?? [];
    list.push(node.id);
    groupChildren.set(gid, list);
  }

  const hiddenByCollapse = new Set<string>();
  for (const [gid, childIds] of groupChildren) {
    if (expanded.has(gid)) continue;
    for (const id of childIds) {
      if (id === activeId || queued.has(id) || id === view.selectedResearchNodeId) continue;
      hiddenByCollapse.add(id);
    }
  }

  const layoutNodes = all.filter((n) => visibleIds.has(n.id) && !hiddenByCollapse.has(n.id));
  const depths = computeDepths(layoutNodes);
  const columns = new Map<number, string[]>();
  for (const n of layoutNodes) {
    const d = depths.get(n.id) ?? 0;
    const col = columns.get(d) ?? [];
    col.push(n.id);
    columns.set(d, col);
  }
  for (const [, ids] of columns) {
    ids.sort((a, b) => a.localeCompare(b));
  }

  const positions = new Map<string, { x: number; y: number; depth: number }>();
  const maxDepth = Math.max(0, ...[...depths.values()]);
  for (let d = 0; d <= maxDepth; d++) {
    const ids = columns.get(d) ?? [];
    ids.forEach((id, row) => {
      positions.set(id, {
        depth: d,
        x: d * (NODE_W + COL_GAP),
        y: row * (NODE_H + ROW_GAP),
      });
    });
  }

  const groups: ResearchDagGroupView[] = [];
  for (const [gid, childIds] of groupChildren) {
    const collapsed = !expanded.has(gid);
    const visibleChildren = childIds.filter((id) => !hiddenByCollapse.has(id));
    const parentId = gid.replace(/^exp-group:/, '');
    const parentPos = parentId !== 'housing' ? positions.get(parentId) : undefined;
    let x: number;
    let y: number;
    if (parentPos) {
      x = parentPos.x + NODE_W + COL_GAP;
      y = parentPos.y;
    } else if (visibleChildren.length > 0) {
      const p = positions.get(visibleChildren[0]);
      if (p) {
        x = p.x;
        y = p.y;
      } else {
        x = (depths.get(visibleChildren[0]) ?? 1) * (NODE_W + COL_GAP);
        y = 0;
      }
    } else {
      const sample = childIds[0] ?? '';
      x = (depths.get(sample) ?? 1) * (NODE_W + COL_GAP);
      y = 0;
    }
    groups.push({
      id: gid,
      label: expansionGroupLabel(gid),
      collapsed,
      childIds,
      x,
      y,
    });
  }

  const { remaining } = selectBuildEconomy(snapshot);
  const busy = Boolean(activeId);
  const queueFull = research.queue.length >= RESEARCH_QUEUE_CAP;

  const nodes: ResearchDagNodeView[] = layoutNodes.map((node) => {
    let status: ResearchDagStatus = 'preview';
    if (completed.has(node.id)) status = 'completed';
    else if (activeId === node.id) status = 'active';
    else if (queued.has(node.id)) status = 'queued';
    else if (frontier.has(node.id)) status = 'available';

    const missing = node.requires
      .filter((id) => !completed.has(id))
      .map((id) => byId.get(id)?.name ?? id);
    const cost = asResources(node.startCost);
    const canPay = canAffordResources(remaining, cost);
    const pos = positions.get(node.id)!;

    return {
      id: node.id,
      name: node.name,
      description: node.description,
      kind: node.kind,
      status,
      unlockSummary: unlockSummary(node),
      costLabel:
        status === 'available' || status === 'queued'
          ? formatResourceCost(node.startCost)
          : null,
      startCost: node.startCost,
      progressRequired: node.progressRequired,
      missingPrereqNames: status === 'preview' ? missing : [],
      affordable: status === 'available' && canPay,
      groupId: expansionGroupId(node),
      depth: pos.depth,
      x: pos.x,
      y: pos.y,
    };
  });

  const edges: ResearchDagEdgeView[] = [];
  for (const node of layoutNodes) {
    for (const req of node.requires) {
      if (layoutNodes.some((n) => n.id === req)) {
        edges.push({ from: req, to: node.id });
      }
    }
  }

  const availableXs = nodes.filter((n) => n.status === 'available').map((n) => n.x);
  const frontierFocusX =
    availableXs.length > 0
      ? Math.min(...availableXs)
      : activeId && positions.has(activeId)
        ? positions.get(activeId)!.x
        : 0;

  const activeNode = activeId ? getResearchNode(activeId) : undefined;
  const selected = view.selectedResearchNodeId;
  const selectedView = selected ? nodes.find((n) => n.id === selected) : undefined;

  return {
    nodes,
    edges,
    groups,
    frontierFocusX,
    selectedId: selected,
    busy,
    queueIds: [...research.queue],
    canStart: !busy && selectedView?.status === 'available' && Boolean(selectedView.affordable),
    canEnqueue:
      busy &&
      !queueFull &&
      selectedView?.status === 'available' &&
      Boolean(selectedView.affordable),
    queueFull,
    active:
      research.active && activeNode
        ? {
            id: activeNode.id,
            name: activeNode.name,
            progress: research.active.progress,
            required: activeNode.progressRequired,
            ratio: Math.min(1, research.active.progress / activeNode.progressRequired),
          }
        : null,
  };
}

export const RESEARCH_DAG_NODE_SIZE = { w: NODE_W, h: NODE_H };
