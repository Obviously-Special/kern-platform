/**
 * SPA observation (doc 3 §5.3: "detect client-side route changes without
 * full page refreshes").
 *
 * Replaces URL polling with event-driven signals:
 * - pushState / replaceState are patched (capture the real history API)
 * - popstate covers back/forward
 * - a debounced MutationObserver catches content swaps and step changes
 *   (mutations inside the KERN widget host are ignored)
 */
export type PageChange = 'route' | 'dom';

export function observePage(callback: (change: PageChange) => void, domDebounceMs = 300): () => void {
  const win = window;

  const originalPush = win.history.pushState.bind(win.history);
  const originalReplace = win.history.replaceState.bind(win.history);

  win.history.pushState = function (...args: Parameters<History['pushState']>): void {
    originalPush(...args);
    callback('route');
  };
  win.history.replaceState = function (...args: Parameters<History['replaceState']>): void {
    originalReplace(...args);
    callback('route');
  };
  win.addEventListener('popstate', () => callback('route'));

  let debounceTimer: number | undefined;
  const observer = new MutationObserver((mutations) => {
    // Ignore changes caused by our own widget (it lives inside the host
    // page DOM but never counts as page content)
    if (mutations.every((m) => (m.target as Element).closest?.('[data-kern-sdk]'))) return;
    if (debounceTimer !== undefined) return;
    debounceTimer = win.setTimeout(() => {
      debounceTimer = undefined;
      callback('dom');
    }, domDebounceMs);
  });
  observer.observe(document.body, { childList: true, subtree: true });

  return () => {
    win.history.pushState = originalPush;
    win.history.replaceState = originalReplace;
    win.removeEventListener('popstate', () => callback('route'));
    if (debounceTimer !== undefined) win.clearTimeout(debounceTimer);
    observer.disconnect();
  };
}
