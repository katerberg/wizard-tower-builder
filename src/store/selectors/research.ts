import {
  asResources,
  canAffordResources,
  formatResourceCost,
} from '@/calculations/resources';
import { getResearchNode, listFrontierNodes } from '@/model/research';
import type { ResourceCost } from '@/model/types';
import type { Snapshot } from '../store';
import { selectBuildEconomy } from './build';

export interface ResearchFrontierItem {
  id: string;
  name: string;
  description: string;
  kind: 'blueprint' | 'expansion';
  startCost: ResourceCost;
  costLabel: string;
  progressRequired: number;
  affordable: boolean;
}

export interface ResearchPanelView {
  visible: boolean;
  frontier: ResearchFrontierItem[];
  active: null | {
    id: string;
    name: string;
    progress: number;
    required: number;
    ratio: number;
  };
  busy: boolean;
}

export function selectResearchPanel(snapshot: Snapshot): ResearchPanelView {
  const { game } = snapshot;
  const inRun = game.scene === 'run';
  const inBuild = inRun && game.phase === 'build';
  const { remaining } = selectBuildEconomy(snapshot);
  const active = game.player.research.active;
  const activeNode = active ? getResearchNode(active.nodeId) : undefined;

  const frontier = inBuild
    ? listFrontierNodes(game).map((node) => {
        const cost = asResources(node.startCost);
        return {
          id: node.id,
          name: node.name,
          description: node.description,
          kind: node.kind,
          startCost: node.startCost,
          costLabel: formatResourceCost(node.startCost),
          progressRequired: node.progressRequired,
          affordable: canAffordResources(remaining, cost) && !active,
        };
      })
    : [];

  return {
    visible: inRun && (inBuild || Boolean(active)),
    frontier,
    active:
      active && activeNode
        ? {
            id: activeNode.id,
            name: activeNode.name,
            progress: active.progress,
            required: activeNode.progressRequired,
            ratio: Math.min(1, active.progress / activeNode.progressRequired),
          }
        : null,
    busy: Boolean(active),
  };
}
