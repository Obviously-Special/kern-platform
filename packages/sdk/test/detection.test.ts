// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { detectJourneyState, setSiteConfig, type KernSiteConfig } from '../src/detection';

const config: KernSiteConfig = {
  site_id: 'demo',
  journeys: [
    {
      id: 'booking',
      pathPrefix: '/booking',
      steps: ['experience', 'date', 'extras', 'insurance', 'details', 'review'],
      hints: { stepIndicator: 'ol[data-kern-step-list]', activeClass: 'bg-pine-700' },
    },
  ],
};

beforeEach(() => {
  setSiteConfig(config);
  document.body.innerHTML = '';
});

function stepperDom(activeIndex: number, ariaCurrent = false): void {
  document.body.innerHTML = `
    <ol data-kern-step-list>
      ${['experience', 'date', 'extras', 'insurance', 'details', 'review']
        .map(
          (label, i) =>
            `<li ${i === activeIndex ? `class="${ariaCurrent ? '' : 'bg-pine-700'}" ${ariaCurrent ? 'aria-current="step"' : ''}` : ''}>${i + 1}. ${label}</li>`,
        )
        .join('')}
    </ol>`;
}

describe('detectJourneyState — generic signals (doc 3 §6.1)', () => {
  it('detects the active step via aria-current="step"', () => {
    stepperDom(3, true);
    const state = detectJourneyState('/booking', document);
    expect(state).toMatchObject({
      journey_id: 'booking',
      current_step: 4,
      total_steps: 6,
      current_label: 'insurance',
      source: 'aria-current',
    });
    expect(state!.confidence).toBeGreaterThan(0.9);
  });

  it('falls back to the page-map stepper hint + active class', () => {
    stepperDom(1, false);
    const state = detectJourneyState('/booking', document);
    expect(state).toMatchObject({ current_step: 2, source: 'stepper' });
  });

  it('detects steps from URL patterns when no stepper exists', () => {
    const state = detectJourneyState('/booking/step-3', document);
    expect(state).toMatchObject({ current_step: 3, current_label: 'extras', source: 'url' });
  });

  it('ignores out-of-range URL steps', () => {
    expect(detectJourneyState('/booking/step-9', document)).toBeNull();
  });

  it('returns null outside declared journeys', () => {
    stepperDom(3, true);
    expect(detectJourneyState('/pricing', document)).toBeNull();
  });

  it('returns null when no site config is loaded', () => {
    setSiteConfig(null as unknown as KernSiteConfig);
    stepperDom(3, true);
    expect(detectJourneyState('/booking', document)).toBeNull();
  });
});
