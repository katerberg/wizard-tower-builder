import type { SideJob } from '@/model/types';
import type { Snapshot } from '../store';

export interface SideJobView {
  id: string;
  label: string;
  progress: number;
  remaining: number;
  status: SideJob['status'];
}

export function selectSideJobs(snapshot: Snapshot): SideJobView[] {
  const speed = snapshot.game.simSpeed;
  return snapshot.game.sideJobs.map((job) => {
    const elapsed = job.elapsed;
    const progress = job.status === 'success' ? 1 : Math.min(1, elapsed / job.duration);
    const remaining = job.status === 'success' ? 0 : Math.max(0, job.duration - elapsed) / speed;
    return {
      id: job.id,
      label: job.label,
      progress,
      remaining,
      status: job.status,
    };
  });
}
