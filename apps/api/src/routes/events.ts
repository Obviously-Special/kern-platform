import type { FastifyInstance } from 'fastify';
import { EventEnvelopeSchema } from '@kern/contracts';
import { eventCount, storeEvent } from '../event-buffer.js';

export async function eventRoutes(app: FastifyInstance): Promise<void> {
  app.post('/events', async (req, reply) => {
    const parsed = EventEnvelopeSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'invalid_event',
        details: parsed.error.flatten(),
      });
    }
    const event = parsed.data;
    storeEvent(event);
    app.log.info(
      { event_type: event.type, session_id: event.session_id, site_id: event.site_id },
      'event stored',
    );
    return { accepted: true };
  });

  // v0 dev aid — sanity-check that events are flowing. Replaced by the console in Phase 3.
  app.get('/events/count', async () => ({ count: eventCount() }));
}
