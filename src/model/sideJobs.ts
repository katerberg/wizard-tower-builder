import { SIDE_JOB_SUCCESS_FLASH_SEC } from '@/config/dayNight';
import type { GameState, SideJob, SideJobKind } from './types';

let sideJobCounter = 0;

export function resetSideJobCounter(): void {
  sideJobCounter = 0;
}

export function nextSideJobId(): string {
  sideJobCounter += 1;
  return `sidejob-${sideJobCounter}`;
}

export function enqueueSideJob(
  state: GameState,
  kind: SideJobKind,
  label: string,
  duration: number,
  payload: Record<string, unknown>,
): SideJob {
  const job: SideJob = {
    id: nextSideJobId(),
    kind,
    label,
    duration,
    elapsed: 0,
    payload,
    status: 'running',
  };
  state.sideJobs.push(job);
  return job;
}

export function tickSideJobs(state: GameState, dt: number): void {
  const completed: SideJob[] = [];
  for (const job of state.sideJobs) {
    if (job.status === 'success') {
      job.elapsed += dt;
      if (job.elapsed >= SIDE_JOB_SUCCESS_FLASH_SEC) completed.push(job);
      continue;
    }
    job.elapsed += dt;
    if (job.elapsed >= job.duration) {
      job.status = 'success';
      job.elapsed = 0;
      applySideJobComplete(state, job);
    }
  }
  if (completed.length > 0) {
    const removeIds = new Set(completed.map((j) => j.id));
    state.sideJobs = state.sideJobs.filter((j) => !removeIds.has(j.id));
  }
}

function applySideJobComplete(state: GameState, job: SideJob): void {
  // Handlers register completion callbacks via payload; applied in store handlers.
  const fn = job.payload.onComplete as ((s: GameState, p: Record<string, unknown>) => void) | undefined;
  if (fn) fn(state, job.payload);
}

export function removeSideJob(state: GameState, id: string): void {
  state.sideJobs = state.sideJobs.filter((j) => j.id !== id);
}
