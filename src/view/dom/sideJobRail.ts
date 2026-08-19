import { selectSideJobs } from '@/store/selectors/sideJobs';
import type { Store } from '@/store/store';

export function createSideJobRail(root: HTMLElement, store: Store): () => void {
  return function render(): void {
    const { game } = store.getSnapshot();
    if (game.scene !== 'run' || game.phase !== 'day') {
      root.innerHTML = '';
      root.style.display = 'none';
      return;
    }

    const jobs = selectSideJobs(store.getSnapshot());
    if (jobs.length === 0) {
      root.innerHTML = '';
      root.style.display = 'none';
      return;
    }

    root.style.display = 'flex';
    root.innerHTML = jobs
      .map((job) => {
        const pct = Math.round(job.progress * 100);
        const statusClass = job.status === 'success' ? ' side-job-success' : '';
        const timeLabel =
          job.status === 'success' ? 'Done' : `${Math.ceil(job.remaining)}s`;
        return `
          <div class="side-job-bubble${statusClass}" data-job-id="${job.id}">
            <span class="side-job-label">${job.label}</span>
            <div class="side-job-track"><div class="side-job-fill" style="width:${pct}%"></div></div>
            <span class="side-job-time">${timeLabel}</span>
          </div>`;
      })
      .join('');
  };
}
