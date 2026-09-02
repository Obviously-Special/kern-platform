import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { siteAuthHook } from './auth';
import { chatRoutes } from './routes/chat';
import { eventRoutes } from './routes/events';
import { adminRoutes } from './routes/admin';
import { tenantRoutes } from './routes/tenants';
import { seedDemo } from './tenants/service';

/**
 * App assembly — separated from server.ts so tests can drive the app
 * via fastify inject without opening a port.
 */
export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

  // v0: dev-permissive CORS so the demo site (localhost:3000) can call us.
  // Tighten to an explicit origin allowlist before the first real customer.
  await app.register(cors, { origin: true });

  app.addHook('preHandler', siteAuthHook);

  // Observability: one structured line per request (doc 3 Phase 0:
  // "request, latency, error, token, action traces")
  app.addHook('onResponse', async (req, reply) => {
    app.log.info(
      { method: req.method, url: req.url, status: reply.statusCode, duration_ms: reply.elapsedTime },
      'request',
    );
  });

  seedDemo();

  app.get('/health', async () => ({ status: 'ok', time: new Date().toISOString() }));

  await app.register(chatRoutes);
  await app.register(eventRoutes);
  await app.register(adminRoutes);
  await app.register(tenantRoutes);

  return app;
}
