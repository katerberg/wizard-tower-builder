import type { HandlerContext } from '../context';
import type { Intent } from '../intents';
import { handleBuildIntent } from './build';
import { handleCameraIntent } from './camera';
import { handleDevIntent } from './dev';
import { handleInspectIntent } from './inspect';
import { handleModificationsIntent } from './modifications';
import { handleWaveIntent } from './wave';

export function applyIntent(ctx: HandlerContext, intent: Intent): void {
  switch (intent.type) {
    case 'beginRun':
    case 'startWave':
    case 'restart':
      handleWaveIntent(ctx, intent);
      break;

    case 'selectBlueprint':
    case 'hoverCell':
    case 'inspectRoomAt':
    case 'closeModal':
      handleInspectIntent(ctx, intent);
      break;

    case 'placeSelectedAt':
    case 'removeRoomAt':
    case 'sellRoom':
    case 'undoBuild':
    case 'revertBuild':
      handleBuildIntent(ctx, intent);
      break;

    case 'addModification':
    case 'upgradeModification':
      handleModificationsIntent(ctx, intent);
      break;

    case 'toggleDevMode':
    case 'devAddCurrency':
    case 'devSkipWave':
      handleDevIntent(ctx, intent);
      break;

    case 'scrollCamera':
    case 'setViewportHeight':
      handleCameraIntent(ctx, intent);
      break;
  }
}
