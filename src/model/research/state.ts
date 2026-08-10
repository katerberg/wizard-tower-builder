import {
  asResources,
  canAffordResources,
  formatResourceCost,
  subResources,
} from '@/calculations/resources';
import { addMessage } from '@/model/messages';
import type { GameState, ResourceCost } from '@/model/types';
import { getResearchNode, listResearchNodes, RESEARCH_NODES } from './tree';
import type { PlayerResearchState, ResearchNode, ResearchNodeId } from './types';

export function emptyResearchState(): PlayerResearchState {
  return { completedNodeIds: [], active: null };
}

export function isNodeCompleted(state: GameState, nodeId: ResearchNodeId): boolean {
  return state.player.research.completedNodeIds.includes(nodeId);
}

export function prereqsMet(state: GameState, node: ResearchNode): boolean {
  return node.requires.every((id) => isNodeCompleted(state, id));
}

/** Nodes that can be started: prereqs done, not completed, not the active project. */
export function listFrontierNodes(state: GameState): ResearchNode[] {
  const activeId = state.player.research.active?.nodeId;
  return listResearchNodes().filter((node) => {
    if (isNodeCompleted(state, node.id)) return false;
    if (activeId && node.id === activeId) return false;
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

function completeActiveResearch(state: GameState): void {
  const active = state.player.research.active;
  if (!active) return;
  const node = getResearchNode(active.nodeId);
  if (!node) {
    state.player.research.active = null;
    return;
  }
  if (!state.player.research.completedNodeIds.includes(node.id)) {
    state.player.research.completedNodeIds = [...state.player.research.completedNodeIds, node.id];
  }
  grantNodeUnlocks(state, node);
  state.player.research.active = null;
  addMessage(state, `Research complete: ${node.name}.`, 'info');
}

/**
 * Start researching a frontier node. Spends `startCost` from the build baseline
 * wallet when planning; otherwise from player resources.
 */
export function startResearch(
  state: GameState,
  nodeId: ResearchNodeId,
): { ok: true } | { ok: false; reason: string } {
  if (state.scene !== 'run' || state.phase !== 'build') {
    return { ok: false, reason: 'Research can only start during build phase.' };
  }
  if (state.player.research.active) {
    return { ok: false, reason: 'Already researching something else.' };
  }
  const node = getResearchNode(nodeId);
  if (!node) return { ok: false, reason: 'Unknown research.' };
  if (isNodeCompleted(state, nodeId)) {
    return { ok: false, reason: 'Already researched.' };
  }
  if (!prereqsMet(state, node)) {
    return { ok: false, reason: 'Prerequisites not met.' };
  }

  const cost = asResources(node.startCost);
  if (state.buildBaseline) {
    if (!canAffordResources(state.buildBaseline.resources, cost)) {
      return {
        ok: false,
        reason: `Not enough resources (${formatResourceCost(node.startCost)}).`,
      };
    }
    // Commit into the planning budget so HUD remaining / Start Wave stay consistent.
    state.buildBaseline.resources = subResources(state.buildBaseline.resources, cost);
  } else if (!canAffordResources(state.player.resources, cost)) {
    return {
      ok: false,
      reason: `Not enough resources (${formatResourceCost(node.startCost)}).`,
    };
  } else {
    state.player.resources = subResources(state.player.resources, cost);
  }

  state.player.research.active = { nodeId, progress: 0 };
  addMessage(state, `Research started: ${node.name}. Assign magi to research rooms.`, 'info');
  return { ok: true };
}

/** Apply labor-cycle progress; completes the node when full. */
export function addResearchProgress(state: GameState, amount: number): void {
  const active = state.player.research.active;
  if (!active || amount <= 0) return;
  const node = getResearchNode(active.nodeId);
  if (!node) {
    state.player.research.active = null;
    return;
  }
  active.progress += amount;
  if (active.progress >= node.progressRequired) {
    completeActiveResearch(state);
  }
}

/** Dev / test: instantly complete one node (no cost, no labor). */
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
  if (!state.player.research.completedNodeIds.includes(node.id)) {
    state.player.research.completedNodeIds = [...state.player.research.completedNodeIds, node.id];
  }
  grantNodeUnlocks(state, node);
  addMessage(state, `Dev: unlocked ${node.name}.`, 'info');
  return { ok: true };
}

/** Dev / test: mark every node complete and grant all unlocks. */
export function unlockAllResearch(state: GameState): void {
  for (const node of RESEARCH_NODES) {
    if (!state.player.research.completedNodeIds.includes(node.id)) {
      state.player.research.completedNodeIds.push(node.id);
    }
    grantNodeUnlocks(state, node);
  }
  state.player.research.active = null;
}

export function researchStartCost(nodeId: ResearchNodeId): ResourceCost {
  return getResearchNode(nodeId)?.startCost ?? {};
}
