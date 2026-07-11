import { surfaceContacts } from '../../../calculations/exteriorGraph';
import type { Enemy, ExteriorNode, Tower } from '../../types';

function contactKey(contacts: Set<string>): string {
  return [...contacts].sort().join(',');
}

export function isDiscombobulated(enemy: Enemy): boolean {
  return enemy.discombobulated === true;
}

export function applyDiscombobulated(enemy: Enemy): void {
  if (enemy.discombobulated) return;
  enemy.discombobulated = true;
  enemy.discombobulatedAttachReady = false;
}

function contactsAt(tower: Tower, pos: ExteriorNode): Set<string> {
  return surfaceContacts(tower, pos.col, pos.row);
}

function isAttachmentTransition(tower: Tower, from: ExteriorNode, to: ExteriorNode): boolean {
  return contactKey(contactsAt(tower, from)) !== contactKey(contactsAt(tower, to));
}

/** True when the step should be stubbed (no position change). */
export function shouldStubDiscombobulatedStep(tower: Tower, enemy: Enemy, nextPos: ExteriorNode): boolean {
  if (!isDiscombobulated(enemy)) return false;
  if (!isAttachmentTransition(tower, enemy.pos, nextPos)) return false;
  if (enemy.discombobulatedAttachReady) {
    enemy.discombobulatedAttachReady = false;
    return false;
  }
  enemy.discombobulatedAttachReady = true;
  return true;
}
