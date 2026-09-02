import type { PermissionLevel, PolicyDecision } from '@kern/contracts';
import { DEFAULT_POLICY, evaluatePolicy, type SitePolicy } from './engine';

/**
 * Per-site policy registry v0 — in-memory. Real per-tenant policies live
 * in the tenant config (doc 3 §6.1 "Business rules: what AI may say/do/
 * never do — policy rules").
 */
const policies = new Map<string, SitePolicy>();

export function getPolicy(siteId: string): SitePolicy {
  return policies.get(siteId) ?? { siteId, ...DEFAULT_POLICY };
}

export function setPolicy(siteId: string, policy: Partial<SitePolicy>): SitePolicy {
  const next = { ...DEFAULT_POLICY, ...policy, siteId };
  policies.set(siteId, next);
  return next;
}

/** Deterministic action gate used by the action broker (Phase 2) and the debug endpoint. */
export function checkAction(siteId: string, level: PermissionLevel): PolicyDecision {
  return evaluatePolicy(getPolicy(siteId), level);
}
