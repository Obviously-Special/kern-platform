import type { PageContext, PageElement, PageType } from '@kern/contracts';

/**
 * Live page awareness (doc 3 §5): URL, route, page type, compact visible
 * content, relevant elements, visible errors — never the raw DOM.
 */

/** Generic URL-pattern page classifier — core logic, not customer-specific. */
export function inferPageType(route: string): PageType {
  // Strip query string and fragment — only the path matters for page type
  const path = route.toLowerCase().split('?')[0]!.split('#')[0]!.replace(/\/+$/, '');
  if (!path || path === '/') return 'home';
  const segments = path.split('/').filter(Boolean);
  if (segments.some((s) => s === 'checkout' || s === 'cart')) return 'checkout';
  if (segments.some((s) => s === 'booking' || s === 'book' || s === 'reserve')) return 'booking';
  if (segments.some((s) => s === 'pricing' || s === 'price' || s === 'plans' || s === 'tariff')) return 'pricing';
  if (segments.some((s) => s === 'account' || s === 'profile' || s === 'login' || s === 'settings')) return 'account';
  if (segments.some((s) => s === 'help' || s === 'faq' || s === 'support' || s === 'contact')) return 'help';
  if (segments.some((s) => s === 'search')) return 'search';
  if (segments.some((s) => s === 'product' || s === 'service' || s === 'services' || s === 'tour')) return 'product';
  return 'other';
}

function isVisible(el: Element): boolean {
  const html = el as HTMLElement;
  return html.offsetParent !== null || html.getClientRects().length > 0;
}

/** Buttons, links and inputs a visitor can actually act on. */
function selectRelevantElements(limit = 25): PageElement[] {
  const nodes = document.querySelectorAll<HTMLElement>(
    'button, a[href], input, select, textarea',
  );
  const out: PageElement[] = [];
  for (const el of nodes) {
    if (!isVisible(el)) continue;
    const label =
      el.getAttribute('aria-label') ??
      (el.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 80) ??
      undefined;
    out.push({
      id: el.id || undefined,
      role: el.getAttribute('role') ?? undefined,
      tag: el.tagName.toLowerCase(),
      label: label || undefined,
      href: el instanceof HTMLAnchorElement ? el.getAttribute('href') ?? undefined : undefined,
    });
    if (out.length >= limit) break;
  }
  return out;
}

/** Visible validation errors and warning states. */
function collectVisibleErrors(limit = 10): string[] {
  const out: string[] = [];
  document.querySelectorAll('[role="alert"], [aria-invalid="true"]').forEach((el) => {
    if (!isVisible(el)) return;
    const text = (el as HTMLElement).innerText?.trim().replace(/\s+/g, ' ');
    if (text && !out.includes(text)) out.push(text.slice(0, 300));
    if (out.length >= limit) return;
  });
  return out.slice(0, limit);
}

/** Simple stable hash for change detection without re-serializing. */
export function hashState(parts: string[]): string {
  let h = 5381;
  const s = parts.join('|');
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}

export function capturePageContext(): PageContext {
  const url = window.location.href;
  const route = window.location.pathname;
  const title = document.title || undefined;
  const headings = Array.from(document.querySelectorAll('h1, h2'))
    .slice(0, 5)
    .map((h) => h.textContent?.trim().replace(/\s+/g, ' '))
    .filter((t): t is string => Boolean(t && t.length <= 200));
  const errors = collectVisibleErrors();
  const elements = selectRelevantElements();

  return {
    url,
    route,
    page_type: inferPageType(route),
    visible_text: { title, headings, description: undefined },
    elements,
    errors,
    entities: [],
    state_hash: hashState([url, errors.join('|'), headings.join('|')]),
    timestamp: new Date().toISOString(),
  };
}
