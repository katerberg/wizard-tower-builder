import { FIXED_DT, MAX_FRAME_TIME, MAX_STEPS_PER_FRAME } from '@/config/constants';
import type { Store } from '@/store/store';

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
    accumulator += frameTime;

    let steps = 0;
    const simSpeed = store.getSimSpeed();
    while (accumulator >= FIXED_DT && steps < MAX_STEPS_PER_FRAME) {
      store.captureForRender();
      store.advance(FIXED_DT);
      accumulator -= FIXED_DT;
      steps += 1;
      if (steps >= simSpeed) break;
    }

    store.setRenderAlpha(Math.min(1, accumulator / FIXED_DT));
    store.flush();
    render();
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}
