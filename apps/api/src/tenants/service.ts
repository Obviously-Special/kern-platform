import { randomUUID, timingSafeEqual } from 'node:crypto';
import type { Site, Tenant } from '@kern/contracts';

/**
 * Tenant service v0 — in-memory (like the warehouse).
 * Replaced by the persistent multi-tenant store in the productized phase;
 * the API contract (create/read, key-based site identification) is already final.
 *
 * Site keys identify a site and route requests to its tenant. Because
 * the browser SDK holds them, they are NOT confidential credentials —
 * a production deployment would additionally require origin controls,
 * rate limiting, and stronger session boundaries. Tenant IDs are always
 * stamped server-side from the authenticated site record, never trusted
 * from the client. Keys never enter the shared event schema or model
 * context.
 */
export interface SiteRecord {
  site: Site;
  siteKey: string;
}

const tenants = new Map<string, Tenant>();
const sitesByKey = new Map<string, SiteRecord>();
const sitesById = new Map<string, SiteRecord>();

export function createTenant(input: { name: string; plan?: string; region?: string }): Tenant {
  const tenant: Tenant = {
    tenant_id: `tenant_${randomUUID().slice(0, 8)}`,
    status: 'trial',
    plan: input.plan ?? 'foundation',
    region: input.region ?? 'ch',
  };
  tenants.set(tenant.tenant_id, tenant);
  return tenant;
}

export function createSite(tenantId: string, input: { domain: string; environment?: Site['environment'] }): SiteRecord & { siteKey: string } {
  const tenant = tenants.get(tenantId);
  if (!tenant) throw new Error(`tenant ${tenantId} not found`);
  const site: Site = {
    site_id: `site_${randomUUID().slice(0, 8)}`,
    tenant_id: tenantId,
    domain: input.domain,
    environment: input.environment ?? 'staging',
    adapter_version: 'v0',
  };
  const siteKey = `kern_site_${randomUUID().replace(/-/g, '')}`;
  const record = { site, siteKey };
  sitesByKey.set(siteKey, record);
  sitesById.set(site.site_id, record);
  return { ...record, siteKey };
}

export function getSiteByKey(siteKey: string | undefined): SiteRecord | null {
  if (!siteKey) return null;
  return sitesByKey.get(siteKey) ?? null;
}

export function getSiteById(siteId: string): SiteRecord | null {
  return sitesById.get(siteId) ?? null;
}

export function listSites(): { site: Site; siteKey: string }[] {
  return [...sitesById.values()].map((r) => ({ site: r.site, siteKey: r.siteKey }));
}

/** Constant-time key comparison — auth must not leak timing. */
export function keyMatches(provided: string | undefined, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Dev seed: one tenant + the demo site with a FIXED, clearly-marked
 * development key so the demo site needs zero configuration. Real keys
 * come from createSite() and are random.
 */
export const DEMO_SITE_KEY = 'kern-demo-site-key-v0';

export function seedDemo(): void {
  if (sitesById.has('demo-bergblick')) return;
  const tenant = createTenant({ name: 'Bergblick Adventures (demo)', plan: 'foundation', region: 'ch' });
  const site: Site = {
    site_id: 'demo-bergblick',
    tenant_id: tenant.tenant_id,
    domain: 'localhost:3000',
    environment: 'staging',
    adapter_version: 'v0',
  };
  const record = { site, siteKey: DEMO_SITE_KEY };
  sitesByKey.set(record.siteKey, record);
  sitesById.set(site.site_id, record);
}
