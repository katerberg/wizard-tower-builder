import type { Store } from '@/store/store';

export function createMessageLog(root: HTMLElement, store: Store): () => void {
  return function render(): void {
    const { game } = store.getSnapshot();

    // Keep the user's place: only snap to the newest entry if they were already
    // at (or near) the bottom, so scrolling up to read history isn't interrupted.
    const previous = root.querySelector('ul');
    const wasPinnedToBottom =
      !previous || previous.scrollHeight - previous.scrollTop - previous.clientHeight < 4;
    const previousScrollTop = previous ? previous.scrollTop : 0;

    const rows = game.messages
      .map((m) => `<li class="msg msg-${m.kind}">${escapeHtml(m.text)}</li>`)
      .join('');
    root.innerHTML = `<h2>Log</h2><ul>${rows}</ul>`;

    const list = root.querySelector('ul');
    if (list) {
      list.scrollTop = wasPinnedToBottom ? list.scrollHeight : previousScrollTop;
    }
  };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
