/** Build-library sidebar sections (order = display order). */
export type LibrarySectionId =
  | 'structure'
  | 'housing'
  | 'generators'
  | 'infrastructure'
  | 'fortifications'
  | 'damagers';

export interface LibrarySectionDef {
  id: LibrarySectionId;
  label: string;
}

export const LIBRARY_SECTIONS: LibrarySectionDef[] = [
  { id: 'structure', label: 'Spire blocks' },
  { id: 'housing', label: 'Housing' },
  { id: 'generators', label: 'Generators' },
  { id: 'infrastructure', label: 'Infrastructure' },
  { id: 'fortifications', label: 'Fortifications' },
  { id: 'damagers', label: 'Damagers' },
];

/** Blueprint id → library section. Unlisted ids are omitted from grouped view. */
export const BLUEPRINT_LIBRARY_SECTION: Record<string, LibrarySectionId> = {
  stem: 'structure',

  guardroomRoom: 'housing',
  chamberRoom: 'housing',
  quartersRoom: 'housing',

  researchRoom: 'generators',
  storageRoom: 'generators',

  manaSpringRoom: 'generators',
  boilerRoom: 'generators',
  forgeRoom: 'generators',
  pumpRoom: 'generators',

  staircase: 'infrastructure',
  pipe: 'infrastructure',
  elevator: 'infrastructure',

  moat: 'fortifications',
  glacis: 'fortifications',
  parapet: 'fortifications',
  cornice: 'fortifications',
  stakes: 'fortifications',
  barbican: 'fortifications',

  turretRoom: 'damagers',
  flameTurretRoom: 'damagers',
  slotRoom: 'damagers',
  steamTurretRoom: 'damagers',
  hydrantRoom: 'damagers',
};

export function librarySectionFor(blueprintId: string): LibrarySectionId | null {
  return BLUEPRINT_LIBRARY_SECTION[blueprintId] ?? null;
}
