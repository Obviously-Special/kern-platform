import type { FastifyInstance } from 'fastify';
import { EventEnvelopeSchema } from '@kern/contracts';
import { storeEvent } from '../warehouse';

export async function eventRoutes(app: FastifyInstance): Promise<void> {
  app.post('/events', async (req, reply) => {
    const site = req.kernSite;
    if (!site) {
      return reply.status(401).send({ error: 'unauthorized' });
    }

    const parsed = EventEnvelopeSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'invalid_event',
        details: parsed.error.flatten(),
      });
    }
    const event = parsed.data;

    // Strict tenant isolation: the SDK may only emit for its own site,
    // and the tenant is stamped server-side from the authenticated site —
    // never trusted from the client.
    if (event.site_id !== site.site.site_id) {
      return reply.status(403).send({ error: 'site_id_does_not_match_authenticated_site' });
    }

    storeEvent({ ...event, tenant_id: site.site.tenant_id });
    app.log.info(
      { event_type: event.type, session_id: event.session_id, site_id: event.site_id },
      'event stored',
    );
    return { accepted: true };
  });
}
