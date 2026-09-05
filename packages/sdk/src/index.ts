import { capturePageContext } from './context';
import { KernWidget } from './widget';
import { observePage } from './observer';
import { fetchSiteConfig, postEvent, type KernApiConfig } from './api';
import { setSiteConfig } from './detection';
import type { SessionId, SiteId } from '@kern/contracts';

/**
 * Bumped on every SDK release — logged at mount so "is my page running
 * the new bundle?" is always answerable from the browser console.
 */
export const SDK_VERSION = '1.1.0';

export interface KernConfig {
  apiUrl: string;
  siteId: SiteId;
  /** Site key issued by the KERN platform (like a Stripe public key). */
  siteKey: string;
}

export interface KernHandle {
  sessionId: SessionId;
  capture: typeof capturePageContext;
  destroy: () => void;
}

declare global {
  interface Window {
    __kernSdkMounted?: boolean;
  }
}

/**
 * Mount the KERN assistant on the page. Idempotent — safe to call twice
 * (e.g. React StrictMode double-mount in dev).
 *
 * Usage (script tag):
 *   <script src="kern.iife.js"></script>
 *   <script>KernSDK.initKern({ apiUrl: 'https://…', siteId: '…' })</script>
 */
export function initKern(config: KernConfig): KernHandle {
  if (typeof window === 'undefined') {
    throw new Error('KERN SDK must run in a browser');
  }
  if (window.__kernSdkMounted) {
    // Already mounted by an earlier call — return a passive handle
    return {
      sessionId: sessionStorage.getItem('kern_session_id') ?? 'kern-resumed',
      capture: capturePageContext,
      destroy: () => {},
    };
  }
  window.__kernSdkMounted = true;
  console.info(`[kern] sdk ${SDK_VERSION} mounted on ${config.siteId}`);

  let sessionId = sessionStorage.getItem('kern_session_id');
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem('kern_session_id', sessionId);
  }

  const apiConfig: KernApiConfig = {
    apiUrl: config.apiUrl,
    siteId: config.siteId,
    siteKey: config.siteKey,
    sessionId,
  };
  const widget = new KernWidget(apiConfig);

  // page_view on mount
  postEvent(apiConfig, {
    type: 'page_view',
    data: {
      url: window.location.href,
      route: window.location.pathname,
      page_type: capturePageContext().page_type,
      title: document.title,
    },
  });

  // Load the site's public page map (journeys + detection hints) — best-effort
  void fetchSiteConfig(apiConfig).then((config) => {
    if (!config) return;
    setSiteConfig(config);
    widget.refreshPageLabel();
  });

  // SPA observation: event-driven (pushState/popstate + DOM mutations) —
  // route changes emit page_view, any change re-detects the journey step
  let lastUrl = window.location.href;
  let lastStep = capturePageContext().journey?.current_step ?? null;
  let lastErrorHash: string | null = null;

  const onPageChange = (change: 'route' | 'dom') => {
    if (change === 'route' && window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      lastStep = null; // re-detect on the new page
      postEvent(apiConfig, {
        type: 'page_view',
        data: {
          url: window.location.href,
          route: window.location.pathname,
          page_type: capturePageContext().page_type,
          title: document.title,
        },
      });
    }
    widget.refreshPageLabel();
    const ctx = capturePageContext();
    const journey = ctx.journey;
    const step = journey?.current_step ?? null;
    if (step !== null && step !== lastStep) {
      postEvent(apiConfig, {
        type: 'journey_step',
        data: {
          journey_id: journey!.journey_id,
          step,
          total_steps: journey!.total_steps,
          label: journey!.current_label,
          status: 'entered',
        },
      });
      lastStep = step;
    }
    // Visible validation errors are friction signals (deduped per state)
    if (ctx.errors.length > 0 && ctx.state_hash !== lastErrorHash) {
      lastErrorHash = ctx.state_hash;
      postEvent(apiConfig, {
        type: 'error_seen',
        data: { message: ctx.errors[0] },
      });
    }
  };

  const stopObserving = observePage(onPageChange);

  return {
    sessionId,
    capture: capturePageContext,
    destroy: () => {
      stopObserving();
      widget.destroy();
      window.__kernSdkMounted = false;
    },
  };
}
