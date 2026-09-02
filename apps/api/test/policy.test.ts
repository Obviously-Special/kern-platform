import { describe, expect, it } from 'vitest';
import { DEFAULT_POLICY, evaluatePolicy, type SitePolicy } from '../src/policy/engine';

const base: SitePolicy = { siteId: 's', ...DEFAULT_POLICY };

describe('policy engine — the LLM proposes, this layer decides (doc 3 §10)', () => {
  it('allows read-only assistance even when the kill switch is off', () => {
    expect(evaluatePolicy(base, 'read')).toBe('allowed');
    expect(evaluatePolicy(base, 'guide')).toBe('allowed');
  });

  it('denies ALL autonomous actions when the kill switch is off', () => {
    expect(evaluatePolicy(base, 'reversible')).toBe('denied');
    expect(evaluatePolicy(base, 'transactional')).toBe('denied');
  });

  it('allows reversible actions when the switch is on and the level is listed', () => {
    expect(evaluatePolicy({ ...base, autonomousActionsEnabled: true }, 'reversible')).toBe('allowed');
  });

  it('requires confirmation for transactional actions when listed', () => {
    expect(evaluatePolicy({ ...base, autonomousActionsEnabled: true }, 'transactional')).toBe('confirmation_required');
  });

  it('sensitive is never automatic by default — 100% block (doc 3 §14 eval gate)', () => {
    expect(evaluatePolicy({ ...base, autonomousActionsEnabled: true }, 'sensitive')).toBe('denied');
    expect(evaluatePolicy(base, 'sensitive')).toBe('denied');
  });

  it('an explicitly allowed sensitive level still needs the switch on', () => {
    const p = { ...base, allowedLevels: ['sensitive'] as const };
    expect(evaluatePolicy({ ...p, autonomousActionsEnabled: true }, 'sensitive')).toBe('allowed');
    expect(evaluatePolicy(p, 'sensitive')).toBe('denied');
  });
});
