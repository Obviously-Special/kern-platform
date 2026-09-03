import { getSitePageMap } from '../knowledge/page-map';

/**
 * Server-side tool executors (executor: 'api'). Called when the visitor
 * confirms an API-tool action; the result is recorded in the audit
 * ledger and returned to the widget for display.
 */
export interface ApiExecutionResult {
  ok: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

export async function executeApiTool(
  siteId: string,
  tool: string,
  args: Record<string, unknown>,
): Promise<ApiExecutionResult> {
  if (tool === 'book_appointment') {
    const siteMap = getSitePageMap(siteId);
    if (!siteMap) return { ok: false, error: 'site has no page map' };
    try {
      const res = await fetch(`${siteMap.baseUrl}/api/booking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(args),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) return { ok: false, error: `booking api returned ${res.status}` };
      return { ok: true, data: (await res.json()) as Record<string, unknown> };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }
  return { ok: false, error: `unknown api tool: ${tool}` };
}
