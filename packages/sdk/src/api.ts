import type {
  ChatRequest,
  ChatResponse,
  EventEnvelope,
  KernEvent,
  SessionId,
  SiteId,
} from '@kern/contracts';

export interface KernApiConfig {
  apiUrl: string;
  siteId: SiteId;
  sessionId: SessionId;
}

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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`KERN API error ${res.status}`);
  }
  return (await res.json()) as ChatResponse;
}

/** Fire-and-forget event emission — never blocks the page. */
export function postEvent(config: KernApiConfig, event: KernEvent): void {
  const envelope: EventEnvelope = {
    event_id: crypto.randomUUID(),
    type: event.type,
    session_id: config.sessionId,
    site_id: config.siteId,
    tenant_id: config.siteId, // v0: one tenant per site; real tenant mapping arrives with the tenant service
    occurred_at: new Date().toISOString(),
    data: event.data,
  };
  fetch(`${config.apiUrl}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(envelope),
    keepalive: true,
  }).catch(() => {
    /* event pipeline is best-effort at the SDK */
  });
}
