import type { HandlerContext } from '../context';
import type { Intent } from '../intents';
import { handleBuildIntent } from './build';
import { handleCameraIntent } from './camera';
import { handleDevIntent } from './dev';
import { handleInfraIntent } from './infra';
import { handleInspectIntent } from './inspect';
import { handleModificationsIntent } from './modifications';
import { handleStaffIntent } from './staff';
import { handleSpeedIntent } from './speed';
import { handleSpellIntent } from './spells';
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
    case 'toggleLayer':
    case 'closeModal':
      handleInspectIntent(ctx, intent);
      break;

    case 'placeSelectedAt':
      handleInfraIntent(ctx, intent);
      handleBuildIntent(ctx, intent);
      break;
    case 'removeRoomAt':
    case 'removeInfraAt':
      handleInfraIntent(ctx, intent);
      handleBuildIntent(ctx, intent);
      break;

    case 'sellRoom':
    case 'sellStructure':
    case 'undoBuild':
    case 'revertBuild':
      handleBuildIntent(ctx, intent);
      break;

    case 'recruitStaff':
    case 'unrecruitStaff':
    case 'setSlotAllocation':
    case 'setManaSpringAllocation':
      handleStaffIntent(ctx, intent);
      break;

    case 'addModification':
    case 'upgradeModification':
      handleModificationsIntent(ctx, intent);
      break;

    case 'toggleDevMode':
    case 'devAddCurrency':
    case 'devSkipWave':
    case 'devSetSpellSchool':
      handleDevIntent(ctx, intent);
      break;

    case 'scrollCamera':
    case 'setViewportHeight':
      handleCameraIntent(ctx, intent);
      break;

    case 'selectSpell':
    case 'castSpellAt':
    case 'cancelCast':
      handleSpellIntent(ctx, intent);
      break;

    case 'setSimSpeed':
      handleSpeedIntent(ctx, intent);
      break;
  }
}
