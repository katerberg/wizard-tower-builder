import { RESEARCH_CANCEL_REFUND_RATE, RESEARCH_QUEUE_CAP } from '@/config/research';
import {
  addResources,
  asResources,
  canAffordResources,
  formatResourceCost,
  scaleResources,
  subResources,
} from '@/calculations/resources';
import { addMessage } from '@/model/messages';
import type { GameState, ResourceCost, Resources } from '@/model/types';
import { getResearchNode, listResearchNodes, RESEARCH_NODES } from './tree';
import type { PlayerResearchState, ResearchNode, ResearchNodeId } from './types';

export function emptyResearchState(): PlayerResearchState {
  return { completedNodeIds: [], active: null, queue: [] };
}

export function isNodeCompleted(state: GameState, nodeId: ResearchNodeId): boolean {
  return state.player.research.completedNodeIds.includes(nodeId);
}

export function isNodeQueued(state: GameState, nodeId: ResearchNodeId): boolean {
  return state.player.research.queue.includes(nodeId);
}

export function prereqsMet(state: GameState, node: ResearchNode): boolean {
  return node.requires.every((id) => isNodeCompleted(state, id));
}

/** Nodes that can be started or enqueued: prereqs done, not completed/active/queued. */
export function listFrontierNodes(state: GameState): ResearchNode[] {
  const activeId = state.player.research.active?.nodeId;
  const queued = new Set(state.player.research.queue);
  return listResearchNodes().filter((node) => {
    if (isNodeCompleted(state, node.id)) return false;
    if (activeId && node.id === activeId) return false;
    if (queued.has(node.id)) return false;
    return prereqsMet(state, node);
  });
}

function grantNodeUnlocks(state: GameState, node: ResearchNode): void {
  const unlockedBp = new Set(state.player.unlockedBlueprints);
  for (const id of node.unlocksBlueprints ?? []) {
    unlockedBp.add(id);
  }
  state.player.unlockedBlueprints = [...unlockedBp];

  const unlockedMods = new Set(state.player.unlockedModifications);
  for (const id of node.unlocksModifications ?? []) {
    unlockedMods.add(id);
  }
  state.player.unlockedModifications = [...unlockedMods];
}

function spendResearchCost(
  state: GameState,
  cost: Resources,
  label: string,
): { ok: true } | { ok: false; reason: string } {
  if (state.buildBaseline) {
    if (!canAffordResources(state.buildBaseline.resources, cost)) {
      return { ok: false, reason: `Not enough resources (${label}).` };
    }
    state.buildBaseline.resources = subResources(state.buildBaseline.resources, cost);
    return { ok: true };
  }
  if (!canAffordResources(state.player.resources, cost)) {
    return { ok: false, reason: `Not enough resources (${label}).` };
  }
  state.player.resources = subResources(state.player.resources, cost);
  return { ok: true };
}

function refundResearchCost(state: GameState, cost: Resources): void {
  if (state.buildBaseline) {
    state.buildBaseline.resources = addResources(state.buildBaseline.resources, cost);
  } else {
    state.player.resources = addResources(state.player.resources, cost);
  }
}

function floorResources(r: Resources): Resources {
  return {
    gold: Math.floor(r.gold),
    metal: Math.floor(r.metal),
    stone: Math.floor(r.stone),
    souls: Math.floor(r.souls),
  };
}

function promoteQueueHead(state: GameState): void {
  const nextId = state.player.research.queue[0];
  if (!nextId) return;
  state.player.research.queue = state.player.research.queue.slice(1);
  const node = getResearchNode(nextId);
  if (!node) return;
  state.player.research.active = { nodeId: nextId, progress: 0 };
  addMessage(state, `Research started from queue: ${node.name}.`, 'info');
}

function completeActiveResearch(state: GameState): void {
  const active = state.player.research.active;
  if (!active) return;
  const node = getResearchNode(active.nodeId);
  if (!node) {
    state.player.research.active = null;
    promoteQueueHead(state);
    return;
  }
  if (!state.player.research.completedNodeIds.includes(node.id)) {
    state.player.research.completedNodeIds = [...state.player.research.completedNodeIds, node.id];
  }
  grantNodeUnlocks(state, node);
  state.player.research.active = null;
  addMessage(state, `Research complete: ${node.name}.`, 'info');
  promoteQueueHead(state);
}

function clearNodeFromQueue(state: GameState, nodeId: ResearchNodeId): void {
  state.player.research.queue = state.player.research.queue.filter((id) => id !== nodeId);
}

/**
 * Start researching a frontier node while idle. Spends `startCost` from the build
 * baseline wallet when planning; otherwise from player resources.
 */
export function startResearch(
  state: GameState,
  nodeId: ResearchNodeId,
): { ok: true } | { ok: false; reason: string } {
  if (state.scene !== 'run' || state.phase !== 'build') {
    return { ok: false, reason: 'Research can only start during build phase.' };
  }
  if (state.player.research.active) {
    return { ok: false, reason: 'Already researching — enqueue instead.' };
  }
  const node = getResearchNode(nodeId);
  if (!node) return { ok: false, reason: 'Unknown research.' };
  if (isNodeCompleted(state, nodeId)) {
    return { ok: false, reason: 'Already researched.' };
  }
  if (isNodeQueued(state, nodeId)) {
    return { ok: false, reason: 'Already in the research queue.' };
  }
  if (!prereqsMet(state, node)) {
    return { ok: false, reason: 'Prerequisites not met.' };
  }

  const cost = asResources(node.startCost);
  const spent = spendResearchCost(state, cost, formatResourceCost(node.startCost));
  if (!spent.ok) return spent;

  state.player.research.active = { nodeId, progress: 0 };
  addMessage(state, `Research started: ${node.name}. Assign magi to research rooms.`, 'info');
  return { ok: true };
}

/** Pay to queue a frontier node (max RESEARCH_QUEUE_CAP). */
export function enqueueResearch(
  state: GameState,
  nodeId: ResearchNodeId,
): { ok: true } | { ok: false; reason: string } {
  if (state.scene !== 'run' || state.phase !== 'build') {
    return { ok: false, reason: 'Research can only enqueue during build phase.' };
  }
  if (!state.player.research.active) {
    return { ok: false, reason: 'Nothing active — Start research instead.' };
  }
  if (state.player.research.queue.length >= RESEARCH_QUEUE_CAP) {
    return { ok: false, reason: `Research queue is full (${RESEARCH_QUEUE_CAP}).` };
  }
  const node = getResearchNode(nodeId);
  if (!node) return { ok: false, reason: 'Unknown research.' };
  if (isNodeCompleted(state, nodeId)) {
    return { ok: false, reason: 'Already researched.' };
  }
  if (state.player.research.active.nodeId === nodeId) {
    return { ok: false, reason: 'Already researching that.' };
  }
  if (isNodeQueued(state, nodeId)) {
    return { ok: false, reason: 'Already in the research queue.' };
  }
  if (!prereqsMet(state, node)) {
    return { ok: false, reason: 'Prerequisites not met.' };
  }

  const cost = asResources(node.startCost);
  const spent = spendResearchCost(state, cost, formatResourceCost(node.startCost));
  if (!spent.ok) return spent;

  state.player.research.queue = [...state.player.research.queue, nodeId];
  addMessage(state, `Queued research: ${node.name}.`, 'info');
  return { ok: true };
}

/** Remove a queued node and fully refund its start cost. */
export function dequeueResearch(
  state: GameState,
  nodeId: ResearchNodeId,
): { ok: true } | { ok: false; reason: string } {
  if (state.scene !== 'run' || state.phase !== 'build') {
    return { ok: false, reason: 'Can only adjust the queue during build phase.' };
  }
  if (!isNodeQueued(state, nodeId)) {
    return { ok: false, reason: 'Not in the research queue.' };
  }
  const node = getResearchNode(nodeId);
  if (!node) {
    clearNodeFromQueue(state, nodeId);
    return { ok: true };
  }
  clearNodeFromQueue(state, nodeId);
  refundResearchCost(state, asResources(node.startCost));
  addMessage(state, `Removed from queue (full refund): ${node.name}.`, 'economy');
  return { ok: true };
}

/** Cancel active research: half refund, progress lost. Does not touch the queue. */
export function cancelActiveResearch(
  state: GameState,
): { ok: true } | { ok: false; reason: string } {
  if (state.scene !== 'run' || state.phase !== 'build') {
    return { ok: false, reason: 'Can only cancel research during build phase.' };
  }
  const active = state.player.research.active;
  if (!active) return { ok: false, reason: 'Nothing is being researched.' };
  const node = getResearchNode(active.nodeId);
  state.player.research.active = null;
  if (node) {
    const refund = floorResources(
      scaleResources(asResources(node.startCost), RESEARCH_CANCEL_REFUND_RATE),
    );
    refundResearchCost(state, refund);
    addMessage(
      state,
      `Cancelled research: ${node.name}. Refunded ${formatResourceCost(refund)} (progress lost).`,
      'economy',
    );
  }
  return { ok: true };
}

/** Apply labor-cycle progress; completes the node when full. */
export function addResearchProgress(state: GameState, amount: number): void {
  const active = state.player.research.active;
  if (!active || amount <= 0) return;
  const node = getResearchNode(active.nodeId);
  if (!node) {
    state.player.research.active = null;
    promoteQueueHead(state);
    return;
  }
  active.progress += amount;
  if (active.progress >= node.progressRequired) {
    completeActiveResearch(state);
  }
}

/** Dev / test: instantly complete one node (no cost, no labor). Drops from queue without refund. */
export function instantUnlockResearch(
  state: GameState,
  nodeId: ResearchNodeId,
): { ok: true } | { ok: false; reason: string } {
  const node = getResearchNode(nodeId);
  if (!node) return { ok: false, reason: 'Unknown research.' };
  if (isNodeCompleted(state, nodeId)) {
    return { ok: false, reason: 'Already researched.' };
  }
  if (!prereqsMet(state, node)) {
    return { ok: false, reason: 'Prerequisites not met.' };
  }
  if (state.player.research.active?.nodeId === nodeId) {
    state.player.research.active = null;
  }
  clearNodeFromQueue(state, nodeId);
  if (!state.player.research.completedNodeIds.includes(node.id)) {
    state.player.research.completedNodeIds = [...state.player.research.completedNodeIds, node.id];
  }
  grantNodeUnlocks(state, node);
  addMessage(state, `Dev: unlocked ${node.name}.`, 'info');
  return { ok: true };
}

/** Dev / test: mark every node complete and grant all unlocks. Clears queue without refund. */
export function unlockAllResearch(state: GameState): void {
  for (const node of RESEARCH_NODES) {
    if (!state.player.research.completedNodeIds.includes(node.id)) {
      state.player.research.completedNodeIds.push(node.id);
    }
    grantNodeUnlocks(state, node);
  }
  state.player.research.active = null;
  state.player.research.queue = [];
}

export function researchStartCost(nodeId: ResearchNodeId): ResourceCost {
  return getResearchNode(nodeId)?.startCost ?? {};
}
