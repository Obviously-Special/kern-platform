import 'dotenv/config';
import { buildApp } from './app';
import { syncKnowledge } from './knowledge/sync';
import { DEMO_SITE_KEY } from './tenants/service';

const PORT = Number(process.env.PORT ?? 8787);

const app = await buildApp();

// Best-effort knowledge sync at boot — the demo site may not be running yet.
try {
  const result = await syncKnowledge();
  app.log.info(result, 'knowledge synced at boot');
} catch (err) {
  app.log.warn({ err }, 'knowledge sync failed at boot — retry with POST /admin/knowledge/sync');
}

app.log.info({ demo_site_key: DEMO_SITE_KEY }, 'demo site key (development only)');

try {
  await app.listen({ port: PORT, host: '0.0.0.0' });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
