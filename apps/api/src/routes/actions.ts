import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { ActionResultReportSchema } from '@kern/contracts';
import { getPending, resolve } from '../actions/audit';
import { executeApiTool } from '../actions/executors';
import { getTool } from '../actions/registry';
import { evaluatePolicy } from '../policy/engine';
import { getPolicy } from '../policy/service';
import { storeEvent } from '../event-buffer';

/**
 * Action execution endpoints (Phase 2). The ledger is
 * server-authoritative: only actions the broker proposed can be
 * executed or resolved, and every outcome lands in the audit log.
 */
export async function actionRoutes(app: FastifyInstance): Promise<void> {
  /** The visitor confirmed an action — execute it (API tools server-side) or hand it to the SDK (browser tools). */
  app.post('/actions/execute', async (req, reply) => {
    const site = req.kernSite;
    if (!site) return reply.status(401).send({ error: 'unauthorized' });

    const body = req.body as { action_id?: string; session_id?: string };
    const entry = body.action_id ? getPending(body.action_id) : undefined;
    if (!entry || entry.session_id !== body.session_id || entry.site_id !== site.site.site_id) {
      return reply.status(404).send({ error: 'unknown_action' });
    }

    const contract = getTool(entry.tool);

    // Execution-time policy re-check: the visitor confirmed, but the
    // policy may have changed since the proposal — confirmability is
    // re-verified, never assumed.
    const confirmedDecision = evaluatePolicy(getPolicy(site.site.site_id), entry.permission_level, {
      confirmed: true,
    });
    if (confirmedDecision !== 'allowed') {
      resolve(entry.action_id, 'failed', 'policy denies execution');
      return reply.status(403).send({ error: 'policy_denied' });
    }

    if (contract?.executor === 'api') {
      const result = await executeApiTool(site.site.site_id, entry.tool, entry.args);
      const resolved = resolve(
        entry.action_id,
        result.ok ? 'succeeded' : 'failed',
        result.error,
        result.ok ? JSON.stringify(result.data) : undefined,
      );
      if (resolved) {
        storeEvent({
          event_id: randomUUID(),
          type: result.ok ? 'action_succeeded' : 'action_failed',
          session_id: entry.session_id,
          site_id: entry.site_id,
          tenant_id: entry.tenant_id,
          occurred_at: new Date().toISOString(),
          data: { action_id: entry.action_id, ...(result.error ? { error: result.error } : {}) },
        });
      }
      return { action_id: entry.action_id, disposition: 'executed', result };
    }

    if (contract?.executor === 'browser') {
      return {
        action_id: entry.action_id,
        disposition: 'execute_locally',
        action: {
          action_id: entry.action_id,
          tool: entry.tool,
          label: entry.label ?? entry.tool,
          permission_level: entry.permission_level,
          decision: entry.decision,
          args: entry.args,
        },
      };
    }

    return reply.status(400).send({ error: 'unexecutable_action' });
  });

  /** The SDK reports the outcome of a locally executed (or skipped) action. */
  app.post('/actions/result', async (req, reply) => {
    const site = req.kernSite;
    if (!site) return reply.status(401).send({ error: 'unauthorized' });

    const parsed = ActionResultReportSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid_report', details: parsed.error.flatten() });
    }
    const { action_id, session_id, result, error, evidence } = parsed.data;

    const entry = getPending(action_id);
    if (!entry || entry.session_id !== session_id || entry.site_id !== site.site.site_id) {
      return reply.status(404).send({ error: 'unknown_action' });
    }

    resolve(action_id, result, error, evidence);
    storeEvent({
      event_id: randomUUID(),
      type: result === 'succeeded' ? 'action_succeeded' : result === 'cancelled' ? 'action_cancelled' : 'action_failed',
      session_id,
      site_id: entry.site_id,
      tenant_id: entry.tenant_id,
      occurred_at: new Date().toISOString(),
      data: { action_id, ...(error ? { error } : {}) },
    });
    return { accepted: true };
  });
}
