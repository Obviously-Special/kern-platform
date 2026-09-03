import { beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

/**
 * Phase 0 exit-criterion tests: "can create a tenant/site and capture a
 * test session safely." Runs the real app via fastify inject — no port.
 * No provider keys are set in this process, so the gateway runs in mock mode.
 */
let app: FastifyInstance;

beforeAll(async () => {
  const { buildApp } = await import('../src/app');
  app = await buildApp();
});

const DEMO_KEY = 'kern-demo-site-key-v0';

const validChatPayload = {
  session_id: 'auth-test-session',
  site_id: 'demo-bergblick',
  page_context: {
    url: 'http://localhost:3000/',
    route: '/',
    page_type: 'home',
    visible_text: { title: 'x', headings: [] },
    elements: [],
    errors: [],
    entities: [],
    state_hash: 'h1',
    timestamp: new Date().toISOString(),
  },
  message: 'hello',
};

const validEventPayload = {
  event_id: 'evt-auth-1',
  type: 'page_view',
  session_id: 'auth-test-session',
  site_id: 'demo-bergblick',
  occurred_at: new Date().toISOString(),
  data: { url: 'http://localhost:3000/', page_type: 'home' },
};

describe('site-key auth', () => {
  it('rejects /chat without a site key', async () => {
    const res = await app.inject({ method: 'POST', url: '/chat', payload: {} });
    expect(res.statusCode).toBe(401);
  });

  it('rejects /events without a site key', async () => {
    const res = await app.inject({ method: 'POST', url: '/events', payload: {} });
    expect(res.statusCode).toBe(401);
  });

  it('rejects an unknown site key', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/chat',
      headers: { 'x-kern-site-key': 'kern_site_wrong' },
      payload: validChatPayload,
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejects a forged site_id that does not match the authenticated site', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/chat',
      headers: { 'x-kern-site-key': DEMO_KEY },
      payload: { ...validChatPayload, site_id: 'someone-elses-site' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('accepts an authenticated chat request with the seeded demo key', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/chat',
      headers: { 'x-kern-site-key': DEMO_KEY },
      payload: validChatPayload,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveProperty('reply');
  });
});

describe('event tenant isolation', () => {
  it('accepts a valid event and stamps the tenant server-side', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/events',
      headers: { 'x-kern-site-key': DEMO_KEY },
      payload: validEventPayload,
    });
    expect(res.statusCode).toBe(200);
  });

  it('ignores a forged tenant_id — storage is stamped from the authenticated site', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/events',
      headers: { 'x-kern-site-key': DEMO_KEY },
      payload: { ...validEventPayload, tenant_id: 'evil-tenant' },
    });
    expect(res.statusCode).toBe(200);
    // The forged tenant must not exist in the buffer
    const count = await app.inject({ method: 'GET', url: '/admin/events/count?tenant_id=evil-tenant' });
    expect(count.json()).toEqual({ count: 0 });
  });
});

describe('site config (public page-map slice)', () => {
  it('requires a site key', async () => {
    const res = await app.inject({ method: 'GET', url: '/site-config' });
    expect(res.statusCode).toBe(401);
  });

  it('serves the demo journeys with their detection hints', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/site-config',
      headers: { 'x-kern-site-key': DEMO_KEY },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.site_id).toBe('demo-bergblick');
    expect(body.journeys).toHaveLength(1);
    expect(body.journeys[0]).toMatchObject({
      id: 'booking',
      pathPrefix: '/booking',
      steps: ['experience', 'date', 'extras', 'insurance', 'details', 'review'],
    });
  });
});

describe('tenant admin', () => {
  it('creates a tenant and a site with a random key', async () => {
    const t = await app.inject({
      method: 'POST',
      url: '/admin/tenants',
      payload: { name: 'Test Co', plan: 'foundation', region: 'ch' },
    });
    expect(t.statusCode).toBe(200);
    const tenantId = t.json().tenant_id;

    const s = await app.inject({
      method: 'POST',
      url: '/admin/sites',
      payload: { tenant_id: tenantId, domain: 'test.example', environment: 'staging' },
    });
    expect(s.statusCode).toBe(200);
    expect(s.json().site_key).toMatch(/^kern_site_/);
  });
});
