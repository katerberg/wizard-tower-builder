import { faceOf, surfaceContacts } from '../../calculations/exteriorGraph';
import { getEnemyTemplate } from '../enemies';
import { applyDiscombobulated } from './air/discombobulated';
import { resolveSubCellDisplacement } from './air/displacement';
import { applyCollisionDamage, detachEnemy, wasOnWall } from './air/fallCollision';
import { GUST_PUSH_SUB_CELLS } from './air/constants';
import {
  gustAffectedCells,
  computePushDelta,
  computePushDeltaFromCenter,
  enemyInGustCell,
} from './air/push';
import type { SpellDef } from './types';

export const gust: SpellDef = {
  id: 'gust',
  name: 'Gust',
  glyph: 'G',
  description: 'Instant shove on a cell and its neighbors. Rips climbers off the wall — Discombobulated.',
  manaCost: 3,
  cooldown: 2,
  targeting: 'gridPoint',
  range: 8,
  damage: 0,
  cast(ctx, target) {
    if (target.kind !== 'cell') return;
    const cells = gustAffectedCells(target.cell);
    let hits = 0;
    for (const enemy of ctx.state.enemies) {
      if (enemy.currentHp <= 0) continue;
      const inBlast = cells.some((c) => enemyInGustCell(enemy.pos, c));
      if (!inBlast) continue;

      const enemyMacro = cells.find((c) => enemyInGustCell(enemy.pos, c))!;
      const template = getEnemyTemplate(enemy.templateId);
      const isFlier = template?.movement.canFly === true;
      const delta = isFlier
        ? computePushDeltaFromCenter(enemyMacro, target.cell)
        : computePushDelta(ctx.state.tower, enemyMacro);
      const hadWall = !isFlier && wasOnWall(ctx.state.tower, enemy.pos);
      const push = resolveSubCellDisplacement(
        ctx.state.tower,
        enemy.pos,
        delta.dc,
        delta.dr,
        GUST_PUSH_SUB_CELLS,
        isFlier,
      );

      enemy.pos = {
        ...enemy.pos,
        col: push.pos.col,
        row: push.pos.row,
        face: faceOf(ctx.state.tower, push.pos.col, push.pos.row),
      };
      enemy.path = [];
      enemy.pathIndex = 0;
      enemy.pathGoalKey = undefined;

      if (push.hitRoom && !isFlier) {
        applyCollisionDamage(ctx.state, enemy, 'Gust');
      }

      if (!isFlier) {
        const afterContacts = surfaceContacts(ctx.state.tower, enemy.pos.col, enemy.pos.row);
        if (hadWall && afterContacts.size === 0) {
          detachEnemy(ctx.state, enemy);
        } else if (hadWall) {
          applyDiscombobulated(enemy);
        }
      }
      hits += 1;
    }
    if (hits > 0) {
      ctx.log(`Gust rips ${hits} ${hits === 1 ? 'foe' : 'foes'} off the wall.`, 'combat');
    }
  },
};
