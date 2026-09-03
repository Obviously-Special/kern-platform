import type { JourneyState } from '@kern/contracts';

/**
 * Journey-step detection (doc 3 §6.1 "context mapping: current step").
 *
 * Generic signals in priority order — the core never knows a customer's
 * DOM. Per-site overrides arrive as page-map hints from /site-config.
 * Every result carries its source and confidence so answers stay
 * explainable (doc 3: "explainable calculations").
 */
export interface SiteJourneyHints {
  /** Selector for the stepper container (used by the stepper signal). */
  stepIndicator?: string;
  /** Class marking the active step item (site-specific). */
  activeClass?: string;
}

export interface SiteJourneyConfig {
  id: string;
  /** Route prefix this journey applies to, e.g. "/booking". */
  pathPrefix: string;
  steps: string[];
  hints?: SiteJourneyHints;
}

export interface KernSiteConfig {
  site_id: string;
  journeys: SiteJourneyConfig[];
}

let siteConfig: KernSiteConfig | null = null;

export function setSiteConfig(config: KernSiteConfig): void {
  siteConfig = config;
}

export function getSiteConfig(): KernSiteConfig | null {
  return siteConfig;
}

function matchJourney(route: string, journeys: SiteJourneyConfig[]): SiteJourneyConfig | undefined {
  return journeys.find((j) => route === j.pathPrefix || route.startsWith(`${j.pathPrefix}/`));
}

/** Partial detection result — journey_id/total/label are filled by the caller. */
type PartialDetection = Omit<JourneyState, 'journey_id' | 'total_steps' | 'current_label'>;

/** aria-current="step" — the accessibility-standard marker. */
function detectAriaCurrent(doc: Document, journey: SiteJourneyConfig): PartialDetection | null {
  const active = doc.querySelector('[aria-current="step"]');
  if (!active?.parentElement) return null;
  const siblings = [...active.parentElement.children].filter((el) => el.tagName === active.tagName);
  const index = siblings.indexOf(active);
  if (index < 0 || index >= journey.steps.length) return null;
  return { current_step: index + 1, source: 'aria-current', confidence: 0.95 };
}

/** Stepper container found via page-map hints, active item by class. */
function detectStepper(doc: Document, journey: SiteJourneyConfig): PartialDetection | null {
  const hints = journey.hints;
  if (!hints?.stepIndicator) return null;
  const container = doc.querySelector(hints.stepIndicator);
  if (!container) return null;
  const items = [...container.children];
  if (items.length < 2) return null;
  const index = hints.activeClass
    ? items.findIndex((el) => el.className.includes(hints.activeClass!))
    : -1;
  if (index < 0 || index >= journey.steps.length) return null;
  return { current_step: index + 1, source: 'stepper', confidence: 0.9 };
}

/** URL patterns like /booking/step-2, /booking/step/2. */
function detectUrl(route: string, journey: SiteJourneyConfig): PartialDetection | null {
  const m = route.match(/step[-_/]?(\d+)/i);
  if (!m) return null;
  const step = Number(m[1]);
  if (step < 1 || step > journey.steps.length) return null;
  return { current_step: step, source: 'url', confidence: 0.85 };
}

export function detectJourneyState(route: string, doc: Document): JourneyState | null {
  const config = siteConfig;
  if (!config) return null;
  const journey = matchJourney(route, config.journeys);
  if (!journey) return null;

  const detected =
    detectAriaCurrent(doc, journey) ?? detectStepper(doc, journey) ?? detectUrl(route, journey);
  if (!detected) return null;

  return {
    journey_id: journey.id,
    total_steps: journey.steps.length,
    current_step: detected.current_step,
    current_label: journey.steps[detected.current_step - 1],
    source: detected.source,
    confidence: detected.confidence,
  };
}
