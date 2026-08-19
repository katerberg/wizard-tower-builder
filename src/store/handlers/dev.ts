import { reward } from '@/calculations/economy';
import { addResources } from '@/calculations/resources';
import { addMessage } from '@/model/messages';
import { framingHeight } from '@/model/phases';
import { unlockAllResearch } from '@/model/research';
import { setActiveSpellSchool } from '@/model/spells';
import {
  heightProgression,
  WAVE_BUILDER_ENEMY_IDS,
  waveDefFromCounts,
} from '@/model/waves';
import FIXTURES from '@/test/balance/fixtures';
import type { HandlerContext } from '../context';
import type { Intent } from '../intents';
import { applyFixtureToState, extractFixtureFromState } from './fixture';

export function handleDevIntent(ctx: HandlerContext, intent: Intent): void {
  switch (intent.type) {
    case 'toggleDevMode':
      ctx.game.devMode = !ctx.game.devMode;
      if (!ctx.game.devMode) {
        ctx.view.waveBuilder.open = false;
      }
      addMessage(ctx.game, `Dev mode ${ctx.game.devMode ? 'on' : 'off'}.`, 'info');
      break;
    case 'devAddCurrency':
      if (ctx.game.devMode) {
        const grant = { gold: 50, metal: 50, stone: 50, souls: 50 };
        reward(ctx.game, grant);
        if (ctx.game.buildBaseline) {
          ctx.game.buildBaseline.resources = addResources(ctx.game.buildBaseline.resources, grant);
        }
        addMessage(ctx.game, 'Dev: +50 to each resource.', 'economy');
      }
      break;
    case 'devSkipWave':
      if (ctx.game.devMode && ctx.game.phase === 'attack') {
        ctx.game.enemies = [];
        ctx.game.spawnQueue = [];
        addMessage(ctx.game, 'Dev: wave skipped.', 'info');
      }
      break;
    case 'devUnlockAll':
      if (ctx.game.devMode) {
        unlockAllResearch(ctx.game);
        addMessage(ctx.game, 'Dev: unlocked all research / blueprints / mods.', 'info');
      }
      break;
    case 'devSetSpellSchool':
      if (ctx.game.devMode) {
        setActiveSpellSchool(ctx.game, intent.school);
        addMessage(ctx.game, `Dev: spell school set to ${intent.school}.`, 'info');
      }
      break;
    case 'toggleWaveBuilder':
      if (ctx.game.devMode) {
        ctx.view.waveBuilder.open = !ctx.view.waveBuilder.open;
        addMessage(
          ctx.game,
          `Dev: wave builder ${ctx.view.waveBuilder.open ? 'open' : 'closed'}.`,
          'info',
        );
      }
      break;
    case 'devSetWaveCount':
      if (ctx.game.devMode) {
        const id = intent.templateId;
        if (!(WAVE_BUILDER_ENEMY_IDS as readonly string[]).includes(id)) break;
        const count = Math.max(0, Math.floor(intent.count));
        if (count === 0) {
          delete ctx.view.waveBuilder.counts[id];
        } else {
          ctx.view.waveBuilder.counts[id] = count;
        }
      }
      break;
    case 'devClearWaveBuilder':
      if (ctx.game.devMode) {
        ctx.view.waveBuilder.counts = {};
        addMessage(ctx.game, 'Dev: wave builder cleared.', 'info');
      }
      break;
    case 'devLoadCurrentWave':
      if (ctx.game.devMode) {
        const height = framingHeight(ctx.game);
        const wave = heightProgression.getWave({
          height,
          unlockedEnemyIds: new Set(ctx.game.unlockedEnemyIds),
        });
        const counts: Record<string, number> = {};
        for (const entry of wave.entries) {
          if (entry.count > 0) counts[entry.templateId] = entry.count;
        }
        ctx.view.waveBuilder.counts = counts;
        const def = waveDefFromCounts(counts);
        addMessage(
          ctx.game,
          `Dev: loaded height-${height} wave (${def.entries.reduce((n, e) => n + e.count, 0)} foes).`,
          'info',
        );
      }
      break;
    case 'devOpenSaveTower': {
      if (!ctx.game.devMode) break;
      if (ctx.game.phase !== 'build' && ctx.game.scene !== 'gameOver') break;
      const fixture = extractFixtureFromState(ctx.game, ctx.game.sessionSeed);
      ctx.view.modal = { kind: 'saveTower', fixture };
      break;
    }
    case 'devSaveTower': {
      if (!ctx.game.devMode) break;
      if (ctx.game.phase !== 'build' && ctx.game.scene !== 'gameOver') break;
      const fixture = extractFixtureFromState(ctx.game, ctx.game.sessionSeed);
      ctx.view.modal = {
        kind: 'saveTower',
        fixture,
        name: intent.name,
        expect: intent.expect,
      };
      break;
    }
    case 'devOpenLoadTower': {
      if (!ctx.game.devMode) break;
      if (ctx.game.phase !== 'build' && ctx.game.scene !== 'gameOver') break;
      ctx.view.modal = { kind: 'fixtureList' };
      break;
    }
    case 'devLoadFixture': {
      if (!ctx.game.devMode) break;
      if (ctx.game.phase !== 'build' && ctx.game.scene !== 'gameOver') break;
      const fixture = FIXTURES.find((f) => f.id === intent.fixtureId);
      if (!fixture) break;
      ctx.view.modal = { kind: 'fixtureConfirm', fixtureId: fixture.id };
      break;
    }
    case 'devConfirmLoad': {
      if (!ctx.game.devMode) break;
      if (ctx.game.phase !== 'build' && ctx.game.scene !== 'gameOver') break;
      const fixture = FIXTURES.find((f) => f.id === intent.fixtureId);
      if (!fixture) break;
      const newGame = applyFixtureToState(fixture);
      ctx.game = newGame;
      ctx.view.waveBuilder.open = false;
      ctx.view.waveBuilder.counts = {};
      ctx.view.modal = null;
      ctx.view.selectedBlueprintId = null;
      ctx.view.selectedSpellId = null;
      ctx.buildHistory = [];
      addMessage(ctx.game, `Loaded '${fixture.title}' (expect ${fixture.expect}).`, 'info');
      break;
    }
  }
}
