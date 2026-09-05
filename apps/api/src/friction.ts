import { conversationForSession, listSessions, tenantEvents, type StoredEvent } from './warehouse';
import { getSitePageMap } from './knowledge/page-map';

/**
 * Friction engine v1 (doc 3 §11): "cluster interactions by intent + page
 * + outcome. Look for repeated failure patterns." Every cluster carries
 * its evidence (session ids) and an explainable score:
 *
 *   friction score = volume × severity weight × journey value × failure probability
 *
 * It ranks problems for action — it is NOT a scientific truth metric
 * (doc 3 §11.2), which is why every field below is derivable by hand.
 */

export interface FrictionCluster {
  cluster_id: string;
  category: 'repeat_question' | 'help_before_exit' | 'journey_abandonment' | 'error_pattern';
  signature: string;
  hypothesis: string;
  volume: number;
  severity: 'low' | 'medium' | 'high';
  affected_paths: string[];
  score: number;
  failure_probability: number;
  journey_value: number;
  evidence_session_ids: string[];
}

const SEVERITY_WEIGHT = { low: 1, medium: 2, high: 3 } as const;

function journeyValue(siteId: string, journeyId?: string): number {
  const siteMap = getSitePageMap(siteId);
  const journey = siteMap?.journeys.find((j) => j.id === journeyId);
  return journey?.valueChf ?? 100; // customer-config journey value, sane default
}

export function detectFriction(tenantId: string, siteId: string): FrictionCluster[] {
  const events = tenantEvents(tenantId).filter((e) => e.site_id === siteId);
  const sessions = listSessions(tenantId, siteId);
  const clusters: FrictionCluster[] = [];

  // ---- repeat questions ----------------------------------------------------
  const repeats = events.filter((e) => e.type === 'repeat_question');
  const repeatCounts = new Map<string, { count: number; pageTypes: Set<string>; sessionIds: Set<string> }>();
  for (const e of repeats) {
    const signature = String(e.data.signature ?? '');
    const entry = repeatCounts.get(signature) ?? { count: 0, pageTypes: new Set<string>(), sessionIds: new Set<string>() };
    entry.count++;
    if (typeof e.data.page_type === 'string') entry.pageTypes.add(e.data.page_type);
    entry.sessionIds.add(e.session_id);
    repeatCounts.set(signature, entry);
  }
  const totalQuestions = events.filter((e) => e.type === 'question_asked').length || 1;
  for (const [signature, entry] of repeatCounts) {
    // failure probability: sessions with this question that had NO business outcome
    const failed = [...entry.sessionIds].filter((sid) => {
      const s = sessions.find((x) => x.session_id === sid);
      return s && !s.had_business_outcome;
    }).length;
    const failureProbability = entry.sessionIds.size > 0 ? failed / entry.sessionIds.size : 1;
    clusters.push({
      cluster_id: `repeat:${signature}`,
      category: 'repeat_question',
      signature,
      hypothesis: `Visitors repeatedly ask "${signature.slice(0, 80)}" — the answer may be missing or hard to find.`,
      volume: entry.count,
      severity: entry.count >= 3 ? 'high' : 'medium',
      affected_paths: [...entry.pageTypes].map((p) => `page_type:${p}`),
      score: entry.count * SEVERITY_WEIGHT[entry.count >= 3 ? 'high' : 'medium'] * journeyValue(siteId) * failureProbability,
      failure_probability: failureProbability,
      journey_value: journeyValue(siteId),
      evidence_session_ids: [...entry.sessionIds],
    });
  }

  // ---- help before exit -----------------------------------------------------
  for (const s of sessions) {
    if (s.question_count === 0 || s.had_business_outcome) continue;
    const messages = conversationForSession(tenantId, s.session_id);
    if (messages.length === 0) continue;
    // The signature is the visitor's LAST question — the answer's text is
    // not part of the event stream
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUser) continue;
    const signature = lastUser.text.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 80);
    clusters.push({
      cluster_id: `helpexit:${s.session_id}`,
      category: 'help_before_exit',
      signature,
      hypothesis: `Visitors who ask "${signature}" leave without completing a task.`,
      volume: 1,
      severity: 'medium',
      affected_paths: s.last_page_type ? [`page_type:${s.last_page_type}`] : [],
      score: 1 * SEVERITY_WEIGHT.medium * journeyValue(siteId) * 1,
      failure_probability: 1,
      journey_value: journeyValue(siteId),
      evidence_session_ids: [s.session_id],
    });
  }

  // ---- journey abandonment ----------------------------------------------------
  const journeyStops = new Map<string, { count: number; sessionIds: Set<string> }>();
  for (const s of sessions) {
    if (s.max_booking_step === undefined || s.had_business_outcome) continue;
    const key = `booking:step${s.max_booking_step}`;
    const entry = journeyStops.get(key) ?? { count: 0, sessionIds: new Set<string>() };
    entry.count++;
    entry.sessionIds.add(s.session_id);
    journeyStops.set(key, entry);
  }
  const stepReached = new Map<number, number>();
  for (const e of events) {
    if (e.type === 'journey_step' && typeof e.data.step === 'number') {
      stepReached.set(e.data.step, (stepReached.get(e.data.step) ?? 0) + 1);
    }
  }
  for (const [key, entry] of journeyStops) {
    const step = Number(key.split('step')[1]);
    const reached = stepReached.get(step) ?? entry.count;
    const failureProbability = reached > 0 ? entry.count / reached : 1;
    const bookingValue = journeyValue(siteId, 'booking');
    clusters.push({
      cluster_id: key,
      category: 'journey_abandonment',
      signature: key,
      hypothesis: `Booking attempts frequently stop at step ${step} — ${entry.count} session(s) ended there without a booking.`,
      volume: entry.count,
      severity: entry.count >= 3 ? 'high' : 'medium',
      affected_paths: ['/booking'],
      score: entry.count * (entry.count >= 3 ? SEVERITY_WEIGHT.high : SEVERITY_WEIGHT.medium) * bookingValue * failureProbability,
      failure_probability: failureProbability,
      journey_value: bookingValue,
      evidence_session_ids: [...entry.sessionIds],
    });
  }

  // ---- error patterns ---------------------------------------------------------
  const errorCounts = new Map<string, { count: number; sessionIds: Set<string> }>();
  for (const e of events.filter((e) => e.type === 'error_seen')) {
    const message = String(e.data.message ?? 'unknown error').slice(0, 100);
    const entry = errorCounts.get(message) ?? { count: 0, sessionIds: new Set<string>() };
    entry.count++;
    entry.sessionIds.add(e.session_id);
    errorCounts.set(message, entry);
  }
  for (const [message, entry] of errorCounts) {
    clusters.push({
      cluster_id: `error:${message.slice(0, 40)}`,
      category: 'error_pattern',
      signature: message,
      hypothesis: `A validation error ("${message.slice(0, 60)}") appears repeatedly.`,
      volume: entry.count,
      severity: 'high',
      affected_paths: [],
      score: entry.count * SEVERITY_WEIGHT.high * journeyValue(siteId) * 1,
      failure_probability: 1,
      journey_value: journeyValue(siteId),
      evidence_session_ids: [...entry.sessionIds],
    });
  }

  return clusters.sort((a, b) => b.score - a.score);
}
