import { FIXED_DT, MAX_FRAME_TIME, MAX_STEPS_PER_FRAME } from '@/config/constants';
import type { Store } from '@/store/store';

/**
 * Scale real frame time by sim speed and consume fixed timesteps.
 * Returns how many steps to run and the leftover accumulator.
 */
export function planSimSteps(
  accumulator: number,
  frameTime: number,
  simSpeed: number,
  fixedDt = FIXED_DT,
  maxSteps = MAX_STEPS_PER_FRAME,
): { steps: number; accumulator: number } {
  let next = accumulator + frameTime * simSpeed;
  let steps = 0;
  while (next >= fixedDt && steps < maxSteps) {
    next -= fixedDt;
    steps += 1;
  }
  return { steps, accumulator: next };
}

/**
 * Fixed-timestep loop with sim-speed multiplier during attack so longer waves
 * can be fast-forwarded. Positions interpolate between steps.
 */
export function startLoop(store: Store, render: () => void): void {
  let accumulator = 0;
  let last = performance.now();

  function frame(now: number): void {
    const frameTime = Math.min((now - last) / 1000, MAX_FRAME_TIME);
    last = now;

    const { game } = store.getSnapshot();
    const inAttack = game.scene === 'run' && game.phase === 'attack';
    const simSpeed = inAttack ? store.getSimSpeed() : 1;
    const planned = planSimSteps(accumulator, frameTime, simSpeed);
    accumulator = planned.accumulator;

    for (let i = 0; i < planned.steps; i += 1) {
      store.captureForRender();
      store.advance(FIXED_DT);
    }

    store.setRenderAlpha(Math.min(1, accumulator / FIXED_DT));
    store.flush();
    render();
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}
