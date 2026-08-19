import { getResearchNode } from '@/model/research';
import type { Snapshot } from '../store';

export interface ResearchSidebarView {
  visible: boolean;
  devMode: boolean;
  active: null | {
    id: string;
    name: string;
    progress: number;
    required: number;
    ratio: number;
  };
  queue: { id: string; name: string }[];
  ctaLabel: string;
}

export function selectResearchPanel(snapshot: Snapshot): ResearchSidebarView {
  const { game } = snapshot;
  const inRun = game.scene === 'run';
  const inDay = inRun && game.phase === 'day';
  const active = game.player.research.active;
  const activeNode = active ? getResearchNode(active.nodeId) : undefined;
  const queue = game.player.research.queue
    .map((id) => {
      const node = getResearchNode(id);
      return node ? { id: node.id, name: node.name } : null;
    })
    .filter((q): q is { id: string; name: string } => q !== null);

  return {
    visible: inDay || Boolean(active),
    devMode: game.devMode,
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
    queue,
    ctaLabel: active || queue.length > 0 ? 'Edit' : 'Choose research…',
  };
}
