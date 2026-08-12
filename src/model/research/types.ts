import type { ResourceCost } from '@/model/types';

export type ResearchNodeId = string;

export type ResearchNodeKind = 'blueprint' | 'expansion';

export interface ResearchNode {
  id: ResearchNodeId;
  name: string;
  description: string;
  kind: ResearchNodeKind;
  /** Blueprint ids granted on complete (usually one). */
  unlocksBlueprints?: string[];
  /** Modification ids granted on complete. */
  unlocksModifications?: string[];
  requires: ResearchNodeId[];
  startCost: ResourceCost;
  /** Labor-cycle units required (see RESEARCH_PROGRESS_PER_SEC). */
  progressRequired: number;
}

export interface ActiveResearch {
  nodeId: ResearchNodeId;
  progress: number;
}

export interface PlayerResearchState {
  completedNodeIds: ResearchNodeId[];
  active: ActiveResearch | null;
  /** Paid nodes waiting to become active (max RESEARCH_QUEUE_CAP). */
  queue: ResearchNodeId[];
}
