import { z } from 'zod';

/**
 * A paying (or trialing) organization. Strict tenant isolation everywhere:
 * database, events, files, logs — per doc 3 §16.
 */
export const TenantSchema = z.object({
  tenant_id: z.string().min(1),
  status: z.enum(['active', 'trial', 'suspended']),
  plan: z.string().min(1),
  region: z.string().min(1), // e.g. 'ch-zrh', 'eu-de' — data residency
});
export type Tenant = z.infer<typeof TenantSchema>;

/**
 * One customer website/application. A tenant can have multiple sites
 * (production + staging, or several domains).
 */
export const SiteSchema = z.object({
  site_id: z.string().min(1),
  tenant_id: z.string().min(1),
  domain: z.string().min(1),
  environment: z.enum(['production', 'staging']),
  adapter_version: z.string().min(1), // which site adapter/config version is deployed
});
export type Site = z.infer<typeof SiteSchema>;
