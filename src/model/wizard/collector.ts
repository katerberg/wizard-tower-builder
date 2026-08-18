import { macroCellOfNode } from '@/calculations/subGrid';
import { getWizardPosition } from '@/model/tower';
import type { ExteriorNode, GameState } from '@/model/types';

/** Crown perch — solar collector location and wave-start wizard spawn. */
export function getSolarCollectorPosition(state: GameState): ExteriorNode {
  return getWizardPosition(state.tower);
}

export function collectorGoalKey(state: GameState): string {
  const m = macroCellOfNode(getSolarCollectorPosition(state));
  return `${m.col},${m.row}`;
}
