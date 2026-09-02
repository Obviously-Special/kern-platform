import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { chatRoutes } from './routes/chat.js';
import { eventRoutes } from './routes/events.js';

const PORT = Number(process.env.PORT ?? 8787);

const app = Fastify({ logger: true });

// v0: dev-permissive CORS so the demo site (localhost:3000) can call us.
// Tighten to an explicit origin allowlist before the first real customer.
await app.register(cors, { origin: true });

app.get('/health', async () => ({ status: 'ok', time: new Date().toISOString() }));

await app.register(chatRoutes);
await app.register(eventRoutes);

try {
  await app.listen({ port: PORT, host: '0.0.0.0' });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
