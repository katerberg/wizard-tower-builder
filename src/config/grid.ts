export const CELL_SIZE = 48;
/** Sub-cells per macro cell edge — movement uses the finer grid; build/spells stay macro. */
export const SUB_CELLS_PER_MACRO = 3;
export const SUB_CELL_SIZE = CELL_SIZE / SUB_CELLS_PER_MACRO;
export const SUB_GRID_COLS = 16 * SUB_CELLS_PER_MACRO;

export const FIXED_DT = 1 / 60;
export const MAX_FRAME_TIME = 0.25;
/** Attack-phase sim steps per frame (supports sim speed up to 10× at 60fps). */
export const MAX_STEPS_PER_FRAME = 10;

export const GRID_COLS = 16;
/** Minimum visible rows when the stage is very short (does not cap tower height). */
export const MIN_VIEWPORT_ROWS = 3;
/** Empty rows visible above the highest block when scrolled to the top. */
export const VIEWPORT_AIR_ROWS = 8;

export const MAX_OVERHANG_STEP = 1;
/** Minimum width for a buttress room (spire blocks are always 1-wide). */
export const MIN_BUTTRESS_WIDTH = 2;
