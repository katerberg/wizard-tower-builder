import { recentMessages } from '@/model/messages';
import type { Store } from '@/store/store';

export function createMessageLog(root: HTMLElement, store: Store): () => void {
  return function render(): void {
    const { game } = store.getSnapshot();
    const messages = recentMessages(game, 8);
    const rows = messages
      .map((m) => `<li class="msg msg-${m.kind}">${escapeHtml(m.text)}</li>`)
      .join('');
    root.innerHTML = `<h2>Log</h2><ul>${rows}</ul>`;
    const list = root.querySelector('ul');
    if (list) list.scrollTop = list.scrollHeight;
  };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
