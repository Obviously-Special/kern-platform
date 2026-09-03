import type { PageContext } from '@kern/contracts';

/**
 * Intent engine v1 — deterministic, explainable classification
 * (doc 3 §2: Intent Engine, P0; "explainable calculations").
 *
 * Weighted pattern rules score each intent; the winner carries its
 * confidence and the visitor's urgency. The model refines behavior from
 * the DETECTED_INTENT line; the deterministic layer does the labeling.
 * A model-based classifier can join later behind the same interface —
 * but it must earn the extra latency and cost first.
 */
export type IntentLabel =
  | 'question'
  | 'task_attempt'
  | 'objection'
  | 'comparison'
  | 'navigation'
  | 'help_request'
  | 'other';

export interface IntentResult {
  label: IntentLabel;
  confidence: number; // 0..1
  urgency: 'low' | 'medium' | 'high';
}

interface Pattern {
  label: IntentLabel;
  re: RegExp;
  weight: number;
}

const PATTERNS: Pattern[] = [
  { label: 'navigation', re: /show me|point (me|to)|where (is|are|do i find)|which button|which (link|option)|how do i (get|find|go|reach)|take me/i, weight: 1 },
  { label: 'help_request', re: /help|stuck|can'?t|cannot|doesn'?t work|won'?t work|error|problem|not working|failed|get past/i, weight: 1 },
  { label: 'task_attempt', re: /\b(book|reserve|change|update|select|choose|add|remove|fill|start|complete)\b/i, weight: 1 },
  { label: 'objection', re: /expensive|too much|why (is|are|do)|do i (really )?need|worth it|cheaper|surcharge|\brefund(?! policy)\b|\bcancel(?!lation)\b/i, weight: 1 },
  { label: 'comparison', re: /\bvs\b|difference|compare|which (one|option|plan)|or the other|better than/i, weight: 1 },
  { label: 'question', re: /^(what|how|when|where|who|why|can|could|is|are|do|does|will|should)\b|\?\s*$/i, weight: 0.6 },
];

const URGENT = /asap|urgent|immediately|right now|stuck|can'?t get|error|failed/i;

export function detectIntent(message: string, pageContext: PageContext): IntentResult {
  const scores = new Map<IntentLabel, number>();

  for (const pattern of PATTERNS) {
    const match = pattern.re.test(message);
    if (match) {
      scores.set(pattern.label, (scores.get(pattern.label) ?? 0) + pattern.weight);
      // task intent on a booking/checkout page is a stronger signal
      if (pattern.label === 'task_attempt' && (pageContext.page_type === 'booking' || pageContext.page_type === 'checkout')) {
        scores.set(pattern.label, (scores.get(pattern.label) ?? 0) + 0.3);
      }
      // navigation intent with visible errors = the visitor is lost
      if (pattern.label === 'navigation' && pageContext.errors.length > 0) {
        scores.set(pattern.label, (scores.get(pattern.label) ?? 0) + 0.2);
      }
    }
  }

  let label: IntentLabel = 'other';
  let best = 0;
  for (const [candidate, score] of scores) {
    if (score > best) {
      best = score;
      label = candidate;
    }
  }

  const confidence = Math.min(0.95, label === 'other' ? 0.3 : 0.55 + best * 0.15);

  const urgency: IntentResult['urgency'] =
    URGENT.test(message) || pageContext.errors.length > 0 ? 'high' : 'medium';

  return { label, confidence, urgency };
}
