import type { PageContext, PageElement } from '@kern/contracts';
import { inferPageType } from '@kern/contracts';
import { detectJourneyState } from './detection';

// Re-exported for back-compat (moved to @kern/contracts — shared SDK/API logic)
export { inferPageType };

/**
 * Live page awareness (doc 3 §5): URL, route, page type, compact visible
 * content, relevant elements, visible errors — never the raw DOM.
 */

function isVisible(el: Element): boolean {
  const html = el as HTMLElement;
  return html.offsetParent !== null || html.getClientRects().length > 0;
}

/**
 * ref → live node registry: guide mode resolves kern-el-N references back
 * to the elements that were captured, even when the site provides no ids.
 */
const elementRegistry = new Map<string, HTMLElement>();

export function getElementByRef(ref: string): HTMLElement | null {
  return elementRegistry.get(ref) ?? null;
}

/** Buttons, links and inputs a visitor can actually act on. */
function selectRelevantElements(limit = 25): PageElement[] {
  const nodes = document.querySelectorAll<HTMLElement>(
    'button, a[href], input, select, textarea',
  );
  elementRegistry.clear();
  const out: PageElement[] = [];
  for (const el of nodes) {
    if (!isVisible(el)) continue;
    const label =
      el.getAttribute('aria-label') ??
      (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80) ??
      undefined;
    const ref = `kern-el-${out.length}`;
    elementRegistry.set(ref, el);
    out.push({
      id: el.id || undefined,
      ref,
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
  const journey = detectJourneyState(route, document) ?? undefined;

  return {
    url,
    route,
    page_type: inferPageType(route),
    visible_text: { title, headings, description: undefined },
    elements,
    errors,
    entities: [],
    journey,
    state_hash: hashState([url, errors.join('|'), headings.join('|'), journey ? `${journey.current_step}` : '']),
    timestamp: new Date().toISOString(),
  };
}
