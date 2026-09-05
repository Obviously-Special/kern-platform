import { beforeEach, describe, expect, it } from 'vitest';
import { detectFriction } from '../src/friction';
import { runSimulation } from '../src/simulator';
import { resetWarehouse } from '../src/warehouse';

const TENANT = 'friction-test-tenant';
const SITE = 'demo-bergblick';

describe('friction engine — simulator traffic produces explainable clusters (Phase 3 exit)', () => {
  beforeEach(() => {
    resetWarehouse(TENANT);
    runSimulation(TENANT, SITE);
  });

  it('detects journey abandonment — the doc-1 signature pattern', () => {
    const clusters = detectFriction(TENANT, SITE);
    const abandonment = clusters.filter((c) => c.category === 'journey_abandonment');
    expect(abandonment.length).toBeGreaterThan(0);
    // stuck-at-insurance (3 sessions) + date-confusion (2 sessions) die at step 4 / step 2
    const step4 = abandonment.find((c) => c.signature === 'booking:step4');
    expect(step4).toBeDefined();
    expect(step4!.volume).toBe(3);
    expect(step4!.evidence_session_ids).toHaveLength(3);
    expect(step4!.journey_value).toBe(200);
  });

  it('detects repeat questions with evidence', () => {
    const clusters = detectFriction(TENANT, SITE);
    const repeats = clusters.filter((c) => c.category === 'repeat_question');
    expect(repeats.some((c) => c.signature === 'when do bookings close?')).toBe(true);
  });

  it('detects error patterns from error_seen events', () => {
    const clusters = detectFriction(TENANT, SITE);
    const errors = clusters.filter((c) => c.category === 'error_pattern');
    expect(errors.some((c) => c.signature.includes('at least 2 participants'))).toBe(true);
  });

  it('detects help-before-exit sessions without business outcomes', () => {
    const clusters = detectFriction(TENANT, SITE);
    const helpExit = clusters.filter((c) => c.category === 'help_before_exit');
    expect(helpExit.some((c) => c.signature.includes('cancellation policy'))).toBe(true);
  });

  it('ranks clusters by score — the friction score formula is applied', () => {
    const clusters = detectFriction(TENANT, SITE);
    for (let i = 1; i < clusters.length; i++) {
      expect(clusters[i - 1]!.score).toBeGreaterThanOrEqual(clusters[i]!.score);
    }
  });
});
