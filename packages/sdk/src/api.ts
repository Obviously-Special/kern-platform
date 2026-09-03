import type {
  ChatRequest,
  ChatResponse,
  EventEnvelope,
  KernEvent,
  SessionId,
  SiteId,
} from '@kern/contracts';
import type { KernSiteConfig } from './detection';

export interface KernApiConfig {
  apiUrl: string;
  siteId: SiteId;
  /** Site key issued by the KERN platform — authenticates every request. */
  siteKey: string;
  sessionId: SessionId;
}

const authHeaders = (config: KernApiConfig) => ({
  'Content-Type': 'application/json',
  'x-kern-site-key': config.siteKey,
});

export async function postChat(config: KernApiConfig, message: string, history: ChatRequest['history'], pageContext: ChatRequest['page_context']): Promise<ChatResponse> {
  const body: ChatRequest = {
    session_id: config.sessionId,
    site_id: config.siteId,
    page_context: pageContext,
    message,
    history,
  };
  const res = await fetch(`${config.apiUrl}/chat`, {
    method: 'POST',
    headers: authHeaders(config),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`KERN API error ${res.status}`);
  }
  return (await res.json()) as ChatResponse;
}

/**
 * Fetch the public slice of the site's page map (journeys + detection
 * hints). Best-effort — detection simply stays dormant if unavailable.
 */
export async function fetchSiteConfig(config: KernApiConfig): Promise<KernSiteConfig | null> {
  try {
    const res = await fetch(`${config.apiUrl}/site-config`, { headers: authHeaders(config) });
    if (!res.ok) return null;
    return (await res.json()) as KernSiteConfig;
  } catch {
    return null;
  }
}

/** Fire-and-forget event emission — never blocks the page. */
export function postEvent(config: KernApiConfig, event: KernEvent): void {
  // tenant_id is server-stamped from the authenticated site key
  const envelope: EventEnvelope = {
    event_id: crypto.randomUUID(),
    type: event.type,
    session_id: config.sessionId,
    site_id: config.siteId,
    occurred_at: new Date().toISOString(),
    data: event.data,
  };
  fetch(`${config.apiUrl}/events`, {
    method: 'POST',
    headers: authHeaders(config),
    body: JSON.stringify(envelope),
    keepalive: true,
  }).catch(() => {
    /* event pipeline is best-effort at the SDK */
  });
}
