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
  from: string;
  to: string;
}

export interface ResearchDagGroupView {
  id: string;
  label: string;
  collapsed: boolean;
  childIds: string[];
  status: ResearchDagStatus;
  x: number;
  y: number;
}

export interface ResearchDagView {
  nodes: ResearchDagNodeView[];
  edges: ResearchDagEdgeView[];
  groups: ResearchDagGroupView[];
  /** Suggested scroll focus: min y of available nodes (or active). */
  frontierFocusY: number;
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
/** Vertical gap between prereq-depth layers. */
const LAYER_GAP = 48;
/** Horizontal gap between peers in the same layer. */
const PEER_GAP = 32;
const PAD_X = 20;
const PAD_Y = 32;

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

interface DagOccupant {
  key: string;
  depth: number;
  parentKeys: string[];
}

function assignDagPositions(
  occupants: DagOccupant[],
): Map<string, { x: number; y: number; depth: number }> {
  const byDepth = new Map<number, DagOccupant[]>();
  let maxDepth = 0;
  for (const o of occupants) {
    const list = byDepth.get(o.depth) ?? [];
    list.push(o);
    byDepth.set(o.depth, list);
    if (o.depth > maxDepth) maxDepth = o.depth;
  }

  const positions = new Map<string, { x: number; y: number; depth: number }>();
  for (let d = 0; d <= maxDepth; d++) {
    const layer = byDepth.get(d) ?? [];
    const ranked = layer.map((item) => {
      const parentXs = item.parentKeys
        .map((k) => positions.get(k)?.x)
        .filter((x): x is number => x !== undefined);
      const desiredX =
        parentXs.length > 0
          ? parentXs.reduce((sum, x) => sum + x, 0) / parentXs.length
          : PAD_X;
      return { item, desiredX };
    });
    ranked.sort((a, b) => {
      const dx = a.desiredX - b.desiredX;
      if (dx !== 0) return dx;
      const aGroup = a.item.key.startsWith('exp-group:') ? 0 : 1;
      const bGroup = b.item.key.startsWith('exp-group:') ? 0 : 1;
      if (aGroup !== bGroup) return aGroup - bGroup;
      return a.item.key.localeCompare(b.item.key);
    });
    let nextX = PAD_X;
    const y = PAD_Y + d * (NODE_H + LAYER_GAP);
    for (const { item, desiredX } of ranked) {
      const x = Math.max(desiredX, nextX);
      positions.set(item.key, { depth: d, x, y });
      nextX = x + NODE_W + PEER_GAP;
    }
  }
  return positions;
}

function nodeStatus(
  id: string,
  completed: Set<string>,
  activeId: string | null,
  queued: Set<string>,
  frontier: Set<string>,
): ResearchDagStatus {
  if (completed.has(id)) return 'completed';
  if (activeId === id) return 'active';
  if (queued.has(id)) return 'queued';
  if (frontier.has(id)) return 'available';
  return 'preview';
}

function groupStatus(
  childIds: string[],
  completed: Set<string>,
  activeId: string | null,
  queued: Set<string>,
  frontier: Set<string>,
): ResearchDagStatus {
  const statuses = childIds.map((id) =>
    nodeStatus(id, completed, activeId, queued, frontier),
  );
  if (statuses.includes('active')) return 'active';
  if (statuses.includes('queued')) return 'queued';
  if (statuses.includes('available')) return 'available';
  if (statuses.length > 0 && statuses.every((s) => s === 'completed')) return 'completed';
  return 'preview';
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
  const layoutIds = new Set(layoutNodes.map((n) => n.id));
  const depths = computeDepths(all.filter((n) => visibleIds.has(n.id)));

  const occupants: DagOccupant[] = layoutNodes.map((n) => ({
    key: n.id,
    depth: depths.get(n.id) ?? 0,
    parentKeys: n.requires.filter((r) => layoutIds.has(r)),
  }));
  for (const [gid, childIds] of groupChildren) {
    if (expanded.has(gid)) continue;
    const parentId = gid.replace(/^exp-group:/, '');
    const parentDepth = parentId !== 'housing' ? depths.get(parentId) : undefined;
    const childDepths = childIds.map((id) => depths.get(id) ?? 0);
    const depth =
      parentDepth !== undefined
        ? parentDepth + 1
        : childDepths.length > 0
          ? Math.min(...childDepths)
          : 1;
    occupants.push({
      key: gid,
      depth,
      parentKeys: parentId !== 'housing' && layoutIds.has(parentId) ? [parentId] : [],
    });
  }

  const positions = assignDagPositions(occupants);

  const groups: ResearchDagGroupView[] = [];
  for (const [gid, childIds] of groupChildren) {
    const collapsed = !expanded.has(gid);
    const parentId = gid.replace(/^exp-group:/, '');
    const parentPos = parentId !== 'housing' ? positions.get(parentId) : undefined;
    const groupPos = positions.get(gid);
    const childPos = childIds
      .map((id) => positions.get(id))
      .filter((p): p is { x: number; y: number; depth: number } => p !== undefined);
    let x: number;
    let y: number;
    if (collapsed && groupPos) {
      x = groupPos.x;
      y = groupPos.y;
    } else if (childPos.length > 0) {
      x = Math.min(...childPos.map((p) => p.x));
      y = Math.min(...childPos.map((p) => p.y));
    } else if (parentPos) {
      x = parentPos.x;
      y = parentPos.y + NODE_H + LAYER_GAP;
    } else {
      x = PAD_X;
      y = PAD_Y + NODE_H + LAYER_GAP;
    }
    groups.push({
      id: gid,
      label: expansionGroupLabel(gid),
      collapsed,
      childIds,
      status: groupStatus(childIds, completed, activeId, queued, frontier),
      x,
      y,
    });
  }

  const { remaining } = selectBuildEconomy(snapshot);
  const busy = Boolean(activeId);
  const queueFull = research.queue.length >= RESEARCH_QUEUE_CAP;

  const nodes: ResearchDagNodeView[] = layoutNodes.map((node) => {
    const status = nodeStatus(node.id, completed, activeId, queued, frontier);

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
      if (layoutIds.has(req)) {
        edges.push({ from: req, to: node.id });
      }
    }
  }
  for (const group of groups) {
    if (!group.collapsed) continue;
    const parentId = group.id.replace(/^exp-group:/, '');
    if (parentId !== 'housing' && layoutIds.has(parentId)) {
      edges.push({ from: parentId, to: group.id });
    }
  }

  const availableYs = nodes.filter((n) => n.status === 'available').map((n) => n.y);
  const frontierFocusY =
    availableYs.length > 0
      ? Math.min(...availableYs)
      : activeId && positions.has(activeId)
        ? positions.get(activeId)!.y
        : 0;

  const activeNode = activeId ? getResearchNode(activeId) : undefined;
  const selected = view.selectedResearchNodeId;
  const selectedView = selected ? nodes.find((n) => n.id === selected) : undefined;

  return {
    nodes,
    edges,
    groups,
    frontierFocusY,
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
export const RESEARCH_DAG_LAYER_GAP = LAYER_GAP;
