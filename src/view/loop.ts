import { FIXED_DT, MAX_FRAME_TIME } from '@/config/constants';
import type { Store } from '@/store/store';

/**
 * Fixed-timestep accumulator loop. Logic advances in deterministic FIXED_DT
 * steps (capped against the spiral of death); rendering happens once per frame.
 */
export function startLoop(store: Store, render: () => void): void {
  let accumulator = 0;
  let last = performance.now();

  function frame(now: number): void {
    const frameTime = Math.min((now - last) / 1000, MAX_FRAME_TIME);
    last = now;
    accumulator += frameTime;

    while (accumulator >= FIXED_DT) {
      store.advance(FIXED_DT);
      accumulator -= FIXED_DT;
    }

    store.flush();
    render();
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}
