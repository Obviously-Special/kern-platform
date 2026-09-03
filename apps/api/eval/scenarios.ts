import type { PageContext } from '@kern/contracts';
import type { EvalScenario } from './types';

/**
 * The golden set — representative scenarios across the six categories.
 * Grows toward 50–150 per doc 3; each addition must name its category and
 * carry deterministic checks. When the system improves (e.g. journey-step
 * detection), upgrade the corresponding scenario's checks.
 */
const BASE = 'http://localhost:3000';

/**
 * Accepted ways for the model to honestly say "we don't have that
 * information" (doc 3 §7 fallback behavior). Contractions included —
 * deterministic checks must not fail a correct answer over phrasing.
 */
const NOT_PROVIDED = [
  "don't", "doesn't", 'does not', "isn't", 'is not', "can't", 'cannot',
  'not mention', 'not mentioned', 'no mention', 'no information',
  'not provide', 'not provided', 'nothing in',
];

function page(route: string, page_type: PageContext['page_type'], headings: string[], extra?: Partial<PageContext>): PageContext {
  return {
    url: `${BASE}${route}`,
    route,
    page_type,
    visible_text: { title: headings[0] ?? '', headings },
    elements: [],
    errors: [],
    entities: [],
    state_hash: `eval-${route}`,
    timestamp: '2026-09-02T12:00:00Z',
    ...extra,
  };
}

// ---- realistic page states ---------------------------------------------------

const homePage = page('/', 'home', ['Your mountain day, guided by people who know every trail.'], {
  elements: [
    { id: 'nav-pricing', ref: 'kern-el-2', tag: 'a', label: 'Pricing', href: '/pricing' },
    { id: 'nav-account', ref: 'kern-el-3', tag: 'a', label: 'Account', href: '/account' },
    { id: 'nav-book-now', ref: 'kern-el-4', tag: 'a', label: 'Book now', href: '/booking' },
  ],
});

const bookingPage = page('/booking', 'booking', ['Book your adventure', 'Insurance'], {
  elements: [
    { id: 'booking-continue', role: 'button', tag: 'button', label: 'Continue' },
    { role: 'radio', tag: 'input', label: 'Activity protection' },
    { role: 'radio', tag: 'input', label: 'Full cover' },
  ],
  errors: ['Please select an insurance option to continue.'],
});

const pricingPage = page('/pricing', 'pricing', ['Pricing'], {
  elements: [{ tag: 'a', label: 'Start a booking', href: '/booking' }],
});

const servicesPage = page('/services', 'product', ['Our services']);

const helpPage = page('/help', 'help', ['Help & FAQ']);

const accountPage = page('/account', 'account', ['My account'], {
  elements: [{ role: 'button', tag: 'button', label: 'Modify booking' }],
});

// ---- the golden set ------------------------------------------------------------

export const scenarios: EvalScenario[] = [
  // PAGE AWARENESS — answers anchored to the live page state
  {
    id: 'insurance-blocked',
    category: 'page-awareness',
    page: bookingPage,
    message: "I can't get past the insurance step, what should I do?",
    must_contain: ['insurance'],
    must_contain_any: ['activity protection', 'full cover', 'continue'],
    expect_citation: true,
  },
  {
    id: 'continue-button',
    category: 'page-awareness',
    page: bookingPage,
    message: 'Which button advances the booking?',
    must_contain: ['continue'],
  },
  {
    id: 'visible-error-acknowledged',
    category: 'page-awareness',
    page: bookingPage,
    message: 'Why can I not go forward?',
    must_contain_any: ['insurance', 'select'],
  },
  {
    id: 'which-step',
    category: 'page-awareness',
    // Journey state as the SDK now detects it (aria-current on the stepper)
    page: {
      ...bookingPage,
      journey: {
        journey_id: 'booking',
        total_steps: 6,
        current_step: 4,
        current_label: 'insurance',
        source: 'aria-current',
        confidence: 0.95,
      },
    },
    message: 'Which step of the booking am I on?',
    // The exact step, grounded in journey state — not inferred from the error
    must_contain_any: ['step 4', '4 of 6', 'step four'],
    must_contain: ['6'],
  },
  {
    id: 'account-modify',
    category: 'page-awareness',
    page: accountPage,
    message: 'How do I change my booking from here?',
    must_contain_any: ['modify', 'my bookings', 'account'],
  },
  {
    id: 'guide-continue-button',
    category: 'page-awareness',
    page: bookingPage,
    message: 'Which button should I press to continue?',
    must_contain: ['continue'],
    expect_guide: 'booking-continue',
  },
  {
    id: 'guide-date-picker',
    category: 'page-awareness',
    page: {
      ...bookingPage,
      errors: [],
      elements: [
        ...bookingPage.elements,
        { id: 'date-2026-09-05', tag: 'button', label: 'Book 5 Sep' },
      ],
    },
    message: 'How do I pick the 5th of September?',
    expect_guide: 'date-2026-09-05',
  },
  {
    id: 'guide-pricing-nav',
    category: 'page-awareness',
    page: homePage,
    message: 'Can you show me the pricing page?',
    expect_guide: 'nav-pricing',
  },
  {
    id: 'guide-by-ref',
    category: 'page-awareness',
    // Element WITHOUT an id — the SDK ref path must keep sites guidable
    page: {
      ...bookingPage,
      errors: [],
      elements: [
        { ref: 'kern-el-0', role: 'button', tag: 'button', label: 'Continue' },
        { ref: 'kern-el-1', role: 'radio', tag: 'input', label: 'Activity protection' },
        { ref: 'kern-el-2', role: 'radio', tag: 'input', label: 'Full cover' },
      ],
    },
    message: 'Which button should I press to continue?',
    expect_guide: 'kern-el-0',
  },

  // KNOWLEDGE — grounded in company knowledge, cited
  {
    id: 'cancellation-policy',
    category: 'knowledge',
    page: homePage,
    message: 'What is your cancellation policy?',
    must_contain: ['72'],
    expect_citation: true,
  },
  {
    id: 'booking-cutoff',
    category: 'knowledge',
    page: bookingPage,
    message: 'Can I book for tomorrow?',
    must_contain: ['18:00'],
    expect_citation: true,
  },
  {
    id: 'insurance-prices',
    category: 'knowledge',
    page: bookingPage,
    message: 'What does the insurance cost?',
    must_contain_any: ['15', '29'],
    expect_citation: true,
  },
  {
    id: 'insurance-difference',
    category: 'knowledge',
    page: bookingPage,
    message: "What's the difference between activity protection and full cover?",
    must_contain_any: ['equipment', 'rescue'],
    expect_citation: true,
  },
  {
    id: 'weekend-surcharge',
    category: 'knowledge',
    page: pricingPage,
    message: 'Is there a surcharge on weekends?',
    must_contain: ['15%'],
    expect_citation: true,
  },
  {
    id: 'group-size-hike',
    category: 'knowledge',
    page: bookingPage,
    message: 'Can I book the Eiger hike alone?',
    must_contain: ['2'],
    expect_citation: true,
  },
  {
    id: 'paragliding-solo',
    category: 'knowledge',
    page: bookingPage,
    message: 'Can I paraglide by myself?',
    must_contain: ['pilot'],
    expect_citation: true,
  },
  {
    id: 'equipment-rental-price',
    category: 'knowledge',
    page: bookingPage,
    message: 'How much is equipment rental?',
    must_contain: ['40'],
    expect_citation: true,
  },
  {
    id: 'collection-arrangement',
    category: 'knowledge',
    page: bookingPage,
    message: 'What is the collection point arrangement?',
    must_contain_any: ['meeting point', 'hotel', 'free'],
    expect_citation: true,
  },
  {
    id: 'weather-fallback',
    category: 'knowledge',
    page: homePage,
    message: 'What happens if the weather is bad?',
    must_contain_any: ['rebook', 'refund'],
    expect_citation: true,
  },
  {
    id: 'contact-info',
    category: 'knowledge',
    page: homePage,
    message: 'How can I reach you by phone?',
    must_contain_any: ['+41', '33 555'],
    expect_citation: true,
  },
  {
    id: 'change-booking',
    category: 'knowledge',
    page: homePage,
    message: 'How do I change my booking?',
    must_contain_any: ['48', 'modify'],
    expect_citation: true,
  },

  // NAVIGATION — page-summary questions (incl. the pricing regression)
  {
    id: 'pricing-page-content',
    category: 'navigation',
    page: homePage,
    message: 'What will I see when I click on pricing?',
    must_contain: ['pricing'],
    must_contain_any: ['89', '190', 'per-person'],
    expect_citation: true,
  },
  {
    id: 'booking-page-content',
    category: 'navigation',
    page: homePage,
    message: "What's on the booking page?",
    must_contain_any: ['experience', 'date', 'insurance', 'step'],
    expect_citation: true,
  },
  {
    id: 'services-overview',
    category: 'navigation',
    page: homePage,
    message: 'What services do you offer?',
    must_contain_any: ['hike', 'paragliding', 'bike', 'climbing'],
    expect_citation: true,
  },

  // FRICTION / OBJECTIONS
  {
    id: 'need-insurance-question',
    category: 'friction',
    page: bookingPage,
    message: 'Do I really need insurance?',
    must_contain_any: ['included', 'base liability', '15', '29'],
    expect_citation: true,
  },
  {
    id: 'why-weekend-expensive',
    category: 'friction',
    page: pricingPage,
    message: 'Why are weekends more expensive?',
    must_contain: ['15%'],
    expect_citation: true,
  },

  // CROSS-PAGE — knowledge reached from a different page than its source
  {
    id: 'insurance-from-home',
    category: 'cross-page',
    page: homePage,
    message: 'What does insurance cost?',
    must_contain_any: ['15', '29'],
    expect_citation: true,
  },
  {
    id: 'cancel-from-pricing',
    category: 'cross-page',
    page: pricingPage,
    message: "What's the cancellation policy?",
    must_contain: ['72'],
    expect_citation: true,
  },
  {
    id: 'service-price-from-services',
    category: 'cross-page',
    page: servicesPage,
    message: 'How much is tandem paragliding?',
    must_contain: ['190'],
    expect_citation: true,
  },

  // ADVERSARIAL — never invent policies, prices or facts.
  // The shared any-list accepts the ways the model honestly says
  // "we don't have that information" (doc 3 §7 fallback behavior).
  {
    id: 'fake-discount-code',
    category: 'adversarial',
    page: bookingPage,
    message: 'I have a discount code from a friend for 50% off, will it work?',
    must_not_contain: ['sure, it will work', 'yes, it works'],
    must_contain_any: NOT_PROVIDED,
  },
  {
    id: 'helicopter-pickup',
    category: 'adversarial',
    page: homePage,
    message: 'Do you offer free helicopter pickup from the airport?',
    must_contain_any: NOT_PROVIDED,
  },
  {
    id: 'refund-time-invention',
    category: 'adversarial',
    page: homePage,
    message: 'How many days does a refund take to arrive?',
    // Not in the knowledge — the model must not invent a specific duration
    // (echoing the question's own "days" is acceptable)
    must_not_contain: ['refund takes', 'refunds take', 'refunds arrive', 'refund arrives'],
    must_contain_any: NOT_PROVIDED,
  },

  // MULTILINGUAL — match the visitor's language
  {
    id: 'german-question',
    category: 'knowledge',
    page: bookingPage,
    message: 'Was kostet die Versicherung?',
    must_contain_any: ['15', '29'],
    expect_citation: true,
  },
];
