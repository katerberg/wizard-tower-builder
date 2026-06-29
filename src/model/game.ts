import { ENEMY_ATTACK_COOLDOWN, SPAWN_INTERVAL, STARTING_CURRENCY, WIZARD_DEFAULTS } from '@/config/constants';
import { STARTING_BLUEPRINT_IDS } from './blueprints';
import { computeDamage, type Combatant } from '../calculations/combat';
import { spawnNode } from '../calculations/exteriorGraph';
import { getEnemyTemplate } from './enemies';
import { addMessage } from './messages';
import { findPath } from '../calculations/pathfinding';
import { runEnemyStepEffects, runRoomEffects } from './modifications/effects';
import { endWave, loseGame, startRun, captureBuildBaseline } from './phases';
import { seedFrom } from '../calculations/rng';
import { createTower, getWizardPosition } from './tower';
import { goblinNames, bruteNames, wispNames } from '@/static/names';
import type { Enemy, EnemyTemplate, ExteriorNode, GameState } from './types';

let enemyCounter = 0;

export function createInitialState(seed: string | number = 'wizard'): GameState {
  enemyCounter = 0;
  const state: GameState = {
    scene: 'run',
    phase: 'build',
    progressionMode: 'linear',
    levelIndex: 0,
    waveIndex: 0,
    waveTimer: 0,
    spawnTimer: 0,
    spawnQueue: [],
    tick: 0,
    player: {
      currency: STARTING_CURRENCY,
      unlockedBlueprints: [...STARTING_BLUEPRINT_IDS],
      levelIndex: 0,
      wizard: { ...WIZARD_DEFAULTS, hp: WIZARD_DEFAULTS.maxHp, glyph: '@' },
    },
    tower: createTower(),
    enemies: [],
    messages: [],
    rngState: seedFrom(seed),
    devMode: false,
    roomEffectTimers: {},
    buildBaseline: null,
  };
  captureBuildBaseline(state);
  return state;
}

export function beginRun(state: GameState): void {
  startRun(state);
}

const namePools: Record<string, readonly string[]> = {
  goblin: goblinNames,
  brute: bruteNames,
  wisp: wispNames,
};

function pickName(templateId: string, spawnIndex: number): string {
  const pool = namePools[templateId] ?? ['Foe'];
  return pool[spawnIndex % pool.length];
}

function spawnEnemy(state: GameState, template: EnemyTemplate, side: 'left' | 'right'): void {
  const pos = spawnNode(state.tower, side);
  const spawnIndex = enemyCounter;
  const enemy: Enemy = {
    id: `enemy-${enemyCounter++}`,
    templateId: template.id,
    name: pickName(template.id, spawnIndex),
    pos,
    path: [],
    pathIndex: 0,
    currentHp: template.stats.maxHp,
    moveCooldown: 0,
    attackCooldown: 0,
  };
  state.enemies.push(enemy);
}

function reached(a: ExteriorNode, b: ExteriorNode): boolean {
  return a.col === b.col && a.row === b.row;
}

function distance(a: ExteriorNode, b: ExteriorNode): number {
  return Math.hypot(a.col - b.col, a.row - b.row);
}

function enemyCombatant(template: EnemyTemplate): Combatant {
  return { attack: template.stats.strength, defense: 0, dexterity: template.stats.dexterity };
}

/** Advance one fixed timestep. Only meaningful during the attack phase. */
export function step(state: GameState, dt: number): void {
  if (state.scene !== 'run' || state.phase !== 'attack') {
    return;
  }
  state.tick += 1;
  state.waveTimer += dt;

  const wizardPos = getWizardPosition(state.tower);
  const wizard = state.player.wizard;

  // Spawn from the queue, alternating sides.
  state.spawnTimer -= dt;
  if (state.spawnTimer <= 0 && state.spawnQueue.length > 0) {
    const templateId = state.spawnQueue.shift()!;
    const template = getEnemyTemplate(templateId);
    if (template) {
      const side = state.enemies.length % 2 === 0 ? 'left' : 'right';
      spawnEnemy(state, template, side);
    }
    state.spawnTimer = SPAWN_INTERVAL;
  }

  for (const enemy of state.enemies) {
    if (enemy.currentHp <= 0) continue;
    const template = getEnemyTemplate(enemy.templateId);
    if (!template) continue;

    if (enemy.path.length === 0) {
      enemy.path = findPath(state.tower, enemy.pos, wizardPos, template.movement);
      enemy.pathIndex = 0;
    }

    // Stale or partial path: keep climbing toward the wizard instead of freezing.
    if (
      enemy.path.length > 0 &&
      enemy.pathIndex >= enemy.path.length - 1 &&
      !reached(enemy.pos, wizardPos)
    ) {
      enemy.path = findPath(state.tower, enemy.pos, wizardPos, template.movement);
      enemy.pathIndex = 0;
    }

    if (reached(enemy.pos, wizardPos)) {
      enemy.attackCooldown -= dt;
      if (enemy.attackCooldown <= 0) {
        const result = computeDamage(enemyCombatant(template), wizard, state.rngState);
        state.rngState = result.rngState;
        if (result.dodged) {
          addMessage(state, `The wizard dodges ${enemy.name} the ${template.type}.`, 'combat');
        } else {
          wizard.hp = Math.max(0, wizard.hp - result.damage);
          addMessage(state, `${enemy.name} the ${template.type} hits the wizard for ${result.damage}.`, 'combat');
        }
        enemy.attackCooldown = ENEMY_ATTACK_COOLDOWN;
      }
      continue;
    }

    enemy.moveCooldown -= dt;
    if (enemy.moveCooldown <= 0 && enemy.pathIndex < enemy.path.length - 1) {
      enemy.pathIndex += 1;
      enemy.pos = enemy.path[enemy.pathIndex];
      enemy.moveCooldown = 1 / template.speed;
      runEnemyStepEffects(state, enemy);
    }
  }

  // Wizard auto-attacks the nearest enemy in range (v1 stand-in for room turrets).
  wizard.attackCooldown -= dt;
  if (wizard.attackCooldown <= 0) {
    let target: Enemy | null = null;
    let bestDist = Infinity;
    for (const enemy of state.enemies) {
      if (enemy.currentHp <= 0) continue;
      const d = distance(enemy.pos, wizardPos);
      if (d <= wizard.range && d < bestDist) {
        bestDist = d;
        target = enemy;
      }
    }
    if (target) {
      const template = getEnemyTemplate(target.templateId)!;
      const defender: Combatant = { attack: 0, defense: 0, dexterity: template.stats.dexterity };
      const result = computeDamage(wizard, defender, state.rngState);
      state.rngState = result.rngState;
      if (!result.dodged) {
        addMessage(state, `The wizard hits ${target.name} the ${template.type} for ${result.damage}.`, 'combat');
        target.currentHp -= result.damage;
      } else {
        addMessage(state, `${target.name} the ${template.type} dodges the wizard's attack.`, 'combat');
      }
      wizard.attackCooldown = WIZARD_DEFAULTS.attackCooldown;
    } else {
      wizard.attackCooldown = 0; // ready to fire the instant a target enters range
    }
  }

  // Room modifications (turrets, spikes, ...) act on enemies this tick.
  runRoomEffects(state, dt);

  // Reap dead enemies and award currency.
  const survivors: Enemy[] = [];
  for (const enemy of state.enemies) {
    if (enemy.currentHp <= 0) {
      const template = getEnemyTemplate(enemy.templateId);
      if (template) {
        state.player.currency += template.currencyReward;
        addMessage(state, `${enemy.name} the ${template.type} destroyed. +${template.currencyReward} gold.`, 'economy');
      }
    } else {
      survivors.push(enemy);
    }
  }
  state.enemies = survivors;

  if (wizard.hp <= 0) {
    loseGame(state);
    return;
  }

  if (state.spawnQueue.length === 0 && state.enemies.length === 0) {
    endWave(state);
  }
}
