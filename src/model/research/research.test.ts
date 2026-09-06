import { describe, expect, it } from 'vitest';
import { RESEARCH_QUEUE_CAP } from '@/config/research';
import { createInitialState } from '@/model/game';
import {
  addResearchProgress,
  cancelActiveResearch,
  dequeueResearch,
  enqueueResearch,
  getResearchNode,
  instantUnlockResearch,
  listFrontierNodes,
  listResearchNodes,
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
    expect(state.player.unlockedBlueprints).not.toContain('hydrantRoom');
    expect(state.player.unlockedBlueprints).not.toContain('steamTurretRoom');
    expect(state.player.unlockedModifications).toEqual(['spikes']);
    expect(state.player.research.queue).toEqual([]);
  });

  it('lists only plumbing and slots on the starting frontier', () => {
    const state = createInitialState();
    const ids = listFrontierNodes(state).map((n) => n.id).sort();
    expect(ids).toEqual(['bp-pipe', 'bp-slot']);
  });

  it('keeps authored out-degree at most 3', () => {
    const childCounts = new Map<string, number>();
    for (const node of listResearchNodes()) {
      for (const req of node.requires) {
        childCounts.set(req, (childCounts.get(req) ?? 0) + 1);
      }
    }
    for (const [id, count] of childCounts) {
      expect(count, `${id} has ${count} children`).toBeLessThanOrEqual(3);
    }
    expect(getResearchNode('bp-hydrant')).toBeUndefined();
  });

  it('starts research by spending from the build baseline', () => {
    const state = createInitialState();
    const beforeSouls = state.player.resources.souls;
    const result = startResearch(state, 'bp-pipe');
    expect(result.ok).toBe(true);
    expect(state.player.research.active?.nodeId).toBe('bp-pipe');
    const cost = getResearchNode('bp-pipe')!.startCost.souls ?? 0;
    expect(state.player.resources.souls).toBe(beforeSouls - cost);
  });

  it('completes plumbing and unlocks pipe plus hydrant', () => {
    const state = createInitialState();
    startResearch(state, 'bp-pipe');
    const required = getResearchNode('bp-pipe')!.progressRequired;
    addResearchProgress(state, required);
    expect(state.player.research.active).toBeNull();
    expect(state.player.research.completedNodeIds).toContain('bp-pipe');
    expect(state.player.unlockedBlueprints).toContain('pipe');
    expect(state.player.unlockedBlueprints).toContain('hydrantRoom');
    const frontier = listFrontierNodes(state).map((n) => n.id);
    expect(frontier).toContain('bp-boiler');
    expect(frontier).toContain('bp-pump');
    expect(frontier).toContain('bp-mana-spring');
  });

  it('enforces sacred hard gates for steam turret', () => {
    const state = createInitialState();
    state.player.resources.souls = 200;
    startResearch(state, 'bp-pipe');
    addResearchProgress(state, getResearchNode('bp-pipe')!.progressRequired);
    startResearch(state, 'bp-boiler');
    addResearchProgress(state, getResearchNode('bp-boiler')!.progressRequired);
    const frontier = listFrontierNodes(state).map((n) => n.id);
    expect(frontier).toContain('bp-steam-turret');
  });

  it('keeps elevator and overhang off the early frontier', () => {
    const state = createInitialState();
    const startIds = listFrontierNodes(state).map((n) => n.id);
    expect(startIds).not.toContain('bp-elevator');
    expect(startIds).not.toContain('tech-overhang');
    instantUnlockResearch(state, 'bp-pipe');
    const afterPipe = listFrontierNodes(state).map((n) => n.id);
    expect(afterPipe).not.toContain('bp-elevator');
    expect(afterPipe).not.toContain('tech-overhang');
  });

  it('dev unlockAll grants every blueprint and expansion', () => {
    const state = createInitialState();
    unlockAllResearch(state);
    expect(state.player.unlockedBlueprints).toContain('steamTurretRoom');
    expect(state.player.unlockedBlueprints).toContain('elevator');
    expect(state.player.unlockedBlueprints).toContain('hydrantRoom');
    expect(state.player.unlockedBlueprints).toContain('moat');
    expect(state.player.unlockedModifications).toContain('slotExpansion');
    expect(state.player.unlockedModifications).toContain('boilerExpansion');
    expect(state.player.research.queue).toEqual([]);
  });

  it('instantUnlockResearch completes one node without spending', () => {
    const state = createInitialState();
    const beforeSouls = state.player.resources.souls;
    const result = instantUnlockResearch(state, 'bp-pipe');
    expect(result.ok).toBe(true);
    expect(state.player.unlockedBlueprints).toContain('pipe');
    expect(state.player.unlockedBlueprints).toContain('hydrantRoom');
    expect(state.player.research.completedNodeIds).toContain('bp-pipe');
    expect(state.player.resources.souls).toBe(beforeSouls);
    expect(state.player.research.active).toBeNull();
  });

  it('enqueues while active, spends cost, and full-refunds on dequeue', () => {
    const state = createInitialState();
    startResearch(state, 'bp-pipe');
    const before = state.player.resources.souls;
    const slotCost = getResearchNode('bp-slot')!.startCost.souls ?? 0;
    expect(enqueueResearch(state, 'bp-slot').ok).toBe(true);
    expect(state.player.research.queue).toEqual(['bp-slot']);
    expect(state.player.resources.souls).toBe(before - slotCost);
    expect(enqueueResearch(state, 'bp-boiler').ok).toBe(false); // prereq
    expect(dequeueResearch(state, 'bp-slot').ok).toBe(true);
    expect(state.player.research.queue).toEqual([]);
    expect(state.player.resources.souls).toBe(before);
  });

  it('rejects enqueue over the queue cap', () => {
    const state = createInitialState();
    state.player.resources.souls = 500;
    state.player.resources.metal = 500;
    state.player.resources.stone = 500;
    state.player.resources.gold = 500;
    instantUnlockResearch(state, 'bp-pipe');
    instantUnlockResearch(state, 'bp-slot');
    startResearch(state, 'bp-boiler');
    const enqueueable = ['bp-mana-spring', 'bp-pump', 'exp-slot', 'bp-moat', 'bp-parapet'];
    for (let i = 0; i < RESEARCH_QUEUE_CAP; i++) {
      expect(enqueueResearch(state, enqueueable[i]).ok).toBe(true);
    }
    expect(enqueueResearch(state, 'bp-forge').ok).toBe(false); // not frontier yet
    expect(state.player.research.queue).toHaveLength(RESEARCH_QUEUE_CAP);
  });

  it('unlocks overhang placement when Cantilever Framing completes', () => {
    const state = createInitialState();
    for (const id of ['bp-pipe', 'bp-mana-spring', 'bp-leyline-research', 'bp-elevator']) {
      expect(instantUnlockResearch(state, id).ok).toBe(true);
    }
    startResearch(state, 'tech-overhang');
    addResearchProgress(state, getResearchNode('tech-overhang')!.progressRequired);
    expect(state.player.research.completedNodeIds).toContain('tech-overhang');
  });

  it('cancels active research with half refund and clears progress', () => {
    const state = createInitialState();
    const cost = getResearchNode('bp-pipe')!.startCost.souls ?? 0;
    const before = state.player.resources.souls;
    startResearch(state, 'bp-pipe');
    addResearchProgress(state, 5);
    expect(cancelActiveResearch(state).ok).toBe(true);
    expect(state.player.research.active).toBeNull();
    expect(state.player.resources.souls).toBe(before - cost + Math.floor(cost * 0.5));
  });

  it('auto-promotes the queue head when active research completes', () => {
    const state = createInitialState();
    startResearch(state, 'bp-pipe');
    enqueueResearch(state, 'bp-slot');
    addResearchProgress(state, getResearchNode('bp-pipe')!.progressRequired);
    expect(state.player.research.completedNodeIds).toContain('bp-pipe');
    expect(state.player.research.active?.nodeId).toBe('bp-slot');
    expect(state.player.research.active?.progress).toBe(0);
    expect(state.player.research.queue).toEqual([]);
  });

  it('cannot enqueue without an active project', () => {
    const state = createInitialState();
    expect(enqueueResearch(state, 'bp-pipe').ok).toBe(false);
  });
});
