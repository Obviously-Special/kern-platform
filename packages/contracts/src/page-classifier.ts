import type { PageType } from './page-context';

/**
 * Generic URL-pattern page classifier — shared platform logic used by the
 * SDK (browser) and the API (knowledge crawler). Core logic, never
 * customer-specific; per-site overrides belong in the site's page map.
 */
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
