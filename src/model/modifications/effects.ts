import { computeDamage, type Combatant } from '../../calculations/combat';
import { reward as rewardCurrency } from '../../calculations/economy';
import { roomCells } from '../../calculations/grid';
import { getEnemyTemplate } from '../enemies';
import { addMessage } from '../messages';
import { getModification } from './index';
import type { ModEffectContext, ModificationDef } from './types';
import type { Cell, Enemy, GameState, Room } from '../types';

function livingEnemies(state: GameState): Enemy[] {
  return state.enemies.filter((e) => e.currentHp > 0);
}

function minDistanceToFootprint(enemy: Enemy, cells: Cell[]): number {
  let best = Infinity;
  for (const c of cells) {
    const d = Math.hypot(enemy.pos.col - c.col, enemy.pos.row - c.row);
    if (d < best) best = d;
  }
  return best;
}

function minManhattanToFootprint(enemy: Enemy, cells: Cell[]): number {
  let best = Infinity;
  for (const c of cells) {
    const d = Math.abs(enemy.pos.col - c.col) + Math.abs(enemy.pos.row - c.row);
    if (d < best) best = d;
  }
  return best;
}

function enemyTouchesFootprint(enemy: Enemy, cells: Cell[]): boolean {
  return minManhattanToFootprint(enemy, cells) <= 1;
}

function buildContext(
  state: GameState,
  room: Room,
  cells: Cell[],
  level: number,
  dt: number,
  def: ModificationDef,
): ModEffectContext {
  return {
    state,
    room,
    cells,
    level,
    dt,
    enemiesNear: (range) =>
      livingEnemies(state)
        .map((enemy) => ({ enemy, dist: minDistanceToFootprint(enemy, cells) }))
        .filter(({ dist }) => dist <= range)
        .sort((a, b) => a.dist - b.dist)
        .map(({ enemy }) => enemy),
    enemiesTouching: () => livingEnemies(state).filter((enemy) => minManhattanToFootprint(enemy, cells) <= 1),
    attackEnemy: (enemy, attack, dexterity = 0) => {
      const template = getEnemyTemplate(enemy.templateId);
      if (!template) return;
      const attacker: Combatant = { attack, defense: 0, dexterity };
      const defender: Combatant = { attack: 0, defense: 0, dexterity: template.stats.dexterity };
      const result = computeDamage(attacker, defender, state.rngState);
      state.rngState = result.rngState;
      if (result.dodged) {
        addMessage(state, `${enemy.name} the ${template.type} dodges the ${def.name}.`, 'combat');
      } else {
        enemy.currentHp -= result.damage;
        addMessage(state, `${def.name} hits ${enemy.name} the ${template.type} for ${result.damage}.`, 'combat');
      }
    },
    reward: (amount) => rewardCurrency(state, amount),
    log: (text, kind) => addMessage(state, text, kind),
  };
}

/**
 * Contact hazards (spikes, etc.) fire when an enemy finishes a climb step onto
 * or beside a modified room. Standing still does not re-trigger.
 */
export function runEnemyStepEffects(state: GameState, enemy: Enemy): void {
  if (enemy.currentHp <= 0) return;
  for (const room of state.tower.rooms) {
    const cells = roomCells(room.origin, room.size);
    const touches = enemyTouchesFootprint(enemy, cells);
    for (const mod of room.modifications) {
      const def = getModification(mod.id);
      if (!def?.onEnemyStep) continue;
      def.onEnemyStep.run({
        ...buildContext(state, room, cells, mod.level, 0, def),
        enemy,
        enemyTouchesFootprint: touches,
      });
    }
  }
}

/**
 * Run active modification effects for one attack-phase tick. Each modification
 * with an `attack` hook fires on its own cooldown tracked in
 * `state.roomEffectTimers`. Dead enemies are reaped by the caller afterward.
 */
export function runRoomEffects(state: GameState, dt: number): void {
  for (const room of state.tower.rooms) {
    const cells = roomCells(room.origin, room.size);
    for (const mod of room.modifications) {
      const def = getModification(mod.id);
      if (!def?.attack) continue;
      const key = `${room.id}:${def.id}`;
      const remaining = (state.roomEffectTimers[key] ?? 0) - dt;
      if (remaining > 0) {
        state.roomEffectTimers[key] = remaining;
        continue;
      }
      def.attack.run(buildContext(state, room, cells, mod.level, dt, def));
      state.roomEffectTimers[key] = def.attack.cooldown(mod.level);
    }
  }
}

/** Fire wave-clear modification hooks (e.g. passive income). */
export function runWaveClearedEffects(state: GameState): void {
  for (const room of state.tower.rooms) {
    const cells = roomCells(room.origin, room.size);
    for (const mod of room.modifications) {
      const def = getModification(mod.id);
      if (!def?.onWaveCleared) continue;
      def.onWaveCleared(buildContext(state, room, cells, mod.level, 0, def));
    }
  }
}
