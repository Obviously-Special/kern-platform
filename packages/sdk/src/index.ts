import { capturePageContext } from './context';
import { KernWidget } from './widget';
import { postEvent, type KernApiConfig } from './api';
import type { SessionId, SiteId } from '@kern/contracts';

export interface KernConfig {
  apiUrl: string;
  siteId: SiteId;
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

  let sessionId = sessionStorage.getItem('kern_session_id');
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem('kern_session_id', sessionId);
  }

  const apiConfig: KernApiConfig = { apiUrl: config.apiUrl, siteId: config.siteId, sessionId };
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

  // v0 SPA observation: poll for route changes, emit page_view on change
  let lastUrl = window.location.href;
  const poller = window.setInterval(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      widget.refreshPageLabel();
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
  }, 1000);

  return {
    sessionId,
    capture: capturePageContext,
    destroy: () => {
      window.clearInterval(poller);
      widget.destroy();
      window.__kernSdkMounted = false;
    },
  };
}
