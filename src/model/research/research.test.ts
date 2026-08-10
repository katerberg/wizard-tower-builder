import { describe, expect, it } from 'vitest';
import { createInitialState } from '@/model/game';
import {
  addResearchProgress,
  getResearchNode,
  listFrontierNodes,
  startResearch,
  unlockAllResearch,
} from '@/model/research';
import { STARTING_BLUEPRINT_IDS, STARTING_INFRA_BLUEPRINT_IDS } from '@/model/blueprints';

describe('research tech tree', () => {
  it('starts with a starter kit, not the full library', () => {
    const state = createInitialState();
    expect(state.player.unlockedBlueprints.sort()).toEqual(
      [...STARTING_BLUEPRINT_IDS, ...STARTING_INFRA_BLUEPRINT_IDS].sort(),
    );
    expect(state.player.unlockedBlueprints).not.toContain('pipe');
    expect(state.player.unlockedBlueprints).not.toContain('steamTurretRoom');
    expect(state.player.unlockedModifications).toEqual(['spikes']);
  });

  it('lists frontier nodes with met prerequisites', () => {
    const state = createInitialState();
    const frontier = listFrontierNodes(state);
    const ids = frontier.map((n) => n.id);
    expect(ids).toContain('bp-pipe');
    expect(ids).toContain('bp-slot');
    expect(ids).not.toContain('bp-steam-turret');
    expect(ids).not.toContain('bp-boiler');
  });

  it('starts research by spending from the build baseline', () => {
    const state = createInitialState();
    const beforeSouls = state.buildBaseline!.resources.souls;
    const result = startResearch(state, 'bp-pipe');
    expect(result.ok).toBe(true);
    expect(state.player.research.active?.nodeId).toBe('bp-pipe');
    const cost = getResearchNode('bp-pipe')!.startCost.souls ?? 0;
    expect(state.buildBaseline!.resources.souls).toBe(beforeSouls - cost);
  });

  it('completes research and unlocks blueprints', () => {
    const state = createInitialState();
    startResearch(state, 'bp-pipe');
    const required = getResearchNode('bp-pipe')!.progressRequired;
    addResearchProgress(state, required);
    expect(state.player.research.active).toBeNull();
    expect(state.player.research.completedNodeIds).toContain('bp-pipe');
    expect(state.player.unlockedBlueprints).toContain('pipe');
    const frontier = listFrontierNodes(state).map((n) => n.id);
    expect(frontier).toContain('bp-boiler');
  });

  it('enforces sacred hard gates for steam turret', () => {
    const state = createInitialState();
    startResearch(state, 'bp-pipe');
    addResearchProgress(state, getResearchNode('bp-pipe')!.progressRequired);
    startResearch(state, 'bp-boiler');
    addResearchProgress(state, getResearchNode('bp-boiler')!.progressRequired);
    const frontier = listFrontierNodes(state).map((n) => n.id);
    expect(frontier).toContain('bp-steam-turret');
  });

  it('dev unlockAll grants every blueprint and expansion', () => {
    const state = createInitialState();
    unlockAllResearch(state);
    expect(state.player.unlockedBlueprints).toContain('steamTurretRoom');
    expect(state.player.unlockedBlueprints).toContain('elevator');
    expect(state.player.unlockedBlueprints).toContain('moat');
    expect(state.player.unlockedModifications).toContain('slotExpansion');
    expect(state.player.unlockedModifications).toContain('boilerExpansion');
  });
});
